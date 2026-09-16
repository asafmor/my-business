/**
 * Nightly R2 -> B2 object sync: list R2 objects -> skip ones already backed
 * up in B2 with the right size -> copy the rest -> verify size/sha256 ->
 * write a manifest. Run via `npm run backup:sync-r2-to-b2` (see backup.yml).
 *
 * 18.1-18.5: the exported functions below are the testable units; `main()`
 * wires them together and only runs when this file is executed directly, so
 * tests can import the functions without touching real R2/B2.
 *
 * 18.6 (object retention): out of scope for this script. B2 lifecycle rules
 * already keep objects/ (documents, reports) and manifests/ indefinitely,
 * separate from the short daily/weekly database-dump retention — see
 * docs/CLOUD_FOUNDATION.md "Backblaze B2". Object Lock is a bucket-level
 * admin decision the owner has deliberately left disabled there; this script
 * has no credential capable of changing it and does not attempt to.
 */
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { fileURLToPath } from "node:url";

import {
  type BackupKey,
  objectBackupKeyForSourceKey,
  objectsManifestBackupKey,
} from "./layout";
import {
  recordBackupRun,
  formatErrorWithCause,
  withBackupRunRecorder,
} from "./record-run";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

type S3ClientLike = { send(command: unknown): Promise<unknown> };

export type ListedObject = { key: string; sizeBytes: number };

// 18.1: list every R2 object (key + size), paginating with continuation
// tokens rather than assuming a single page.
export async function listAllObjects(
  client: S3ClientLike,
  bucket: string,
): Promise<ListedObject[]> {
  const objects: ListedObject[] = [];
  let continuationToken: string | undefined;

  do {
    const response = (await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    )) as {
      Contents?: { Key?: string; Size?: number }[];
      IsTruncated?: boolean;
      NextContinuationToken?: string;
    };

    for (const item of response.Contents ?? []) {
      if (item.Key !== undefined && item.Size !== undefined) {
        objects.push({ key: item.Key, sizeBytes: item.Size });
      }
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return objects;
}

function isMissingObjectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const response = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };
  return (
    response.$metadata?.httpStatusCode === 404 ||
    response.name === "NoSuchKey" ||
    response.name === "NotFound"
  );
}

async function responseBodyToBytes(body: unknown): Promise<Uint8Array> {
  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof body.transformToByteArray === "function"
  ) {
    return body.transformToByteArray();
  }
  if (body instanceof Uint8Array) return body;
  throw new Error("R2 returned an unreadable object body.");
}

// 18.1: the sha256 recorded on the R2 object at upload time
// (putImmutableObject stores it in the object's Metadata).
export async function getSourceSha256(
  client: S3ClientLike,
  bucket: string,
  key: string,
): Promise<string | undefined> {
  const response = (await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  )) as { Metadata?: Record<string, string> } | undefined;
  return response?.Metadata?.sha256;
}

export type B2CopyStatus =
  | { status: "ok" }
  | { status: "missing" }
  | { status: "size-mismatch"; actualSizeBytes: number | undefined };

// 18.2/18.3: HEAD the B2 destination directly (no separate diff store) to
// decide whether this object still needs copying — the simplest check that
// satisfies "destination exists + size matches", and the basis for skipping
// a full nightly recopy.
export async function checkB2Copy(
  client: S3ClientLike,
  bucket: string,
  key: BackupKey,
  expectedSizeBytes: number,
): Promise<B2CopyStatus> {
  let response: { ContentLength?: number } | undefined;
  try {
    response = (await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    )) as { ContentLength?: number };
  } catch (error) {
    if (isMissingObjectError(error)) return { status: "missing" };
    throw error;
  }

  if (response?.ContentLength !== expectedSizeBytes) {
    return {
      status: "size-mismatch",
      actualSizeBytes: response?.ContentLength,
    };
  }
  return { status: "ok" };
}

// 18.3: copy one object's bytes from R2 to B2, preserving the sha256 the
// original upload recorded (if any) so B2 verification can check it too.
export async function copyObjectToB2(
  r2Client: S3ClientLike,
  r2Bucket: string,
  sourceKey: string,
  b2Client: S3ClientLike,
  b2Bucket: string,
  backupKey: BackupKey,
  sha256: string | undefined,
): Promise<void> {
  const response = (await r2Client.send(
    new GetObjectCommand({ Bucket: r2Bucket, Key: sourceKey }),
  )) as { Body?: unknown; ContentType?: string };
  const body = await responseBodyToBytes(response.Body);

  await b2Client.send(
    new PutObjectCommand({
      Body: body,
      Bucket: b2Bucket,
      ContentType: response.ContentType,
      Key: backupKey,
      Metadata: sha256 ? { sha256 } : undefined,
    }),
  );
}

// 18.4: never trust the PutObject call alone — HEAD the destination back and
// check size (always) and sha256 (when the source had one recorded).
export async function verifyB2Copy(
  client: S3ClientLike,
  bucket: string,
  key: BackupKey,
  expectedSizeBytes: number,
  expectedSha256?: string,
): Promise<void> {
  const response = (await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  )) as
    { ContentLength?: number; Metadata?: Record<string, string> } | undefined;

  if (response?.ContentLength !== expectedSizeBytes) {
    throw new Error(
      `Object backup verification failed for ${key}: expected ${expectedSizeBytes} bytes, found ${response?.ContentLength ?? "missing object"}.`,
    );
  }
  if (expectedSha256 && response.Metadata?.sha256 !== expectedSha256) {
    throw new Error(
      `Object backup verification failed for ${key}: sha256 mismatch (expected ${expectedSha256}, found ${response.Metadata?.sha256 ?? "none"}).`,
    );
  }
}

// 18.5: one manifest entry per object actually copied this run — matches
// the shape SPEC.md §32 shows. Objects already safely in B2 (skipped this
// run) keep the manifest entry an earlier run already wrote for them, so
// this run's manifest only needs to cover what it changed.
export type ObjectManifestEntry = {
  objectKey: string;
  sha256?: string;
  size: number;
  backedUpAt: string;
  source: "r2";
};

async function main(): Promise<void> {
  const connectionUrl = required("NEON_BACKUP_DATABASE_URL");
  const r2Bucket = required("R2_BUCKET");
  const r2Client = new S3Client({
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
    endpoint: `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    region: "auto",
  });

  const b2Bucket = required("B2_BUCKET");
  const b2Client = new S3Client({
    credentials: {
      accessKeyId: required("B2_ACCESS_KEY_ID"),
      secretAccessKey: required("B2_SECRET_ACCESS_KEY"),
    },
    endpoint: required("B2_ENDPOINT"),
    forcePathStyle: true,
    region: required("B2_REGION"),
  });

  const now = new Date();
  const objects = await listAllObjects(r2Client, r2Bucket);
  const manifestEntries: ObjectManifestEntry[] = [];
  let copiedCount = 0;
  let skippedCount = 0;

  for (const object of objects) {
    let backupKey: BackupKey;
    try {
      backupKey = objectBackupKeyForSourceKey(object.key);
    } catch {
      continue; // not a document/report object (e.g. a health-check canary)
    }

    const existing = await checkB2Copy(
      b2Client,
      b2Bucket,
      backupKey,
      object.sizeBytes,
    );
    if (existing.status === "ok") {
      skippedCount += 1;
      continue;
    }

    const sha256 = await getSourceSha256(r2Client, r2Bucket, object.key);
    await copyObjectToB2(
      r2Client,
      r2Bucket,
      object.key,
      b2Client,
      b2Bucket,
      backupKey,
      sha256,
    );
    await verifyB2Copy(b2Client, b2Bucket, backupKey, object.sizeBytes, sha256);

    manifestEntries.push({
      objectKey: object.key,
      sha256,
      size: object.sizeBytes,
      backedUpAt: now.toISOString(),
      source: "r2",
    });
    copiedCount += 1;
  }

  if (manifestEntries.length > 0) {
    await b2Client.send(
      new PutObjectCommand({
        Body: JSON.stringify(manifestEntries, null, 2),
        Bucket: b2Bucket,
        ContentType: "application/json",
        Key: objectsManifestBackupKey(now),
      }),
    );
  }

  // 19.1: the whole run (copies + their per-object verifyB2Copy calls above)
  // succeeded, so record it even when copiedCount is 0 - everything already
  // being in B2 is still a verified-success run, not a no-op to skip.
  await withBackupRunRecorder(connectionUrl, (database) =>
    recordBackupRun(database, {
      kind: "objects",
      ranAt: now,
      detail: `${copiedCount} copied, ${skippedCount} already backed up (${objects.length} total)`,
    }),
  );

  console.log(
    `R2 -> B2 object sync: ${copiedCount} copied, ${skippedCount} already backed up.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(formatErrorWithCause(error));
    process.exitCode = 1;
  });
}
