/**
 * On-demand disaster-recovery object restore: enumerate everything backed up
 * under objects/ in B2 and copy it back into a target R2 bucket, preserving
 * original keys (objects/documents/{id}/original -> documents/{id}/original,
 * etc). Mirrors sync-r2-to-b2.ts in reverse. Never run in CI; this is a
 * manual/local operator command (see docs/RESTORE.md).
 *
 * 20.3: the exported functions below are the testable units; `main()` wires
 * them together and only runs when this file is executed directly.
 *
 * Safety: the target bucket is always RESTORE_TARGET_R2_BUCKET, never
 * R2_BUCKET - a restore must never silently overwrite live application
 * objects because a familiar env var happened to be set.
 */
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { fileURLToPath } from "node:url";

import { sourceKeyForObjectBackupKey } from "./layout";
import { formatErrorWithCause } from "./record-run";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

type S3ClientLike = { send(command: unknown): Promise<unknown> };

export type ListedBackupObject = { key: string; sizeBytes: number };

// 20.3: list every object under objects/ in B2, paginating with
// continuation tokens (mirrors listAllObjects in sync-r2-to-b2.ts).
export async function listB2Objects(
  client: S3ClientLike,
  bucket: string,
): Promise<ListedBackupObject[]> {
  const objects: ListedBackupObject[] = [];
  let continuationToken: string | undefined;

  do {
    const response = (await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "objects/",
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
  throw new Error("B2 returned an unreadable object body.");
}

// 20.3: the sha256 recorded on the B2 object at backup time (copyObjectToB2
// in sync-r2-to-b2.ts preserves it in Metadata when the source R2 object had
// one).
export async function getBackupSha256(
  client: S3ClientLike,
  bucket: string,
  key: string,
): Promise<string | undefined> {
  const response = (await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  )) as { Metadata?: Record<string, string> } | undefined;
  return response?.Metadata?.sha256;
}

// 20.3: copy one object's bytes from B2 back to R2, at its original
// (pre-backup) key, preserving the sha256 metadata for later verification.
export async function copyObjectToR2(
  b2Client: S3ClientLike,
  b2Bucket: string,
  backupKey: string,
  r2Client: S3ClientLike,
  r2Bucket: string,
  targetKey: string,
  sha256: string | undefined,
): Promise<void> {
  const response = (await b2Client.send(
    new GetObjectCommand({ Bucket: b2Bucket, Key: backupKey }),
  )) as { Body?: unknown; ContentType?: string };
  const body = await responseBodyToBytes(response.Body);

  await r2Client.send(
    new PutObjectCommand({
      Body: body,
      Bucket: r2Bucket,
      ContentType: response.ContentType,
      Key: targetKey,
      Metadata: sha256 ? { sha256 } : undefined,
    }),
  );
}

// 20.3: never trust the PutObject call alone - HEAD the restored object back
// and check size (always) and sha256 (when the backup had one recorded).
export async function verifyRestoredObject(
  client: S3ClientLike,
  bucket: string,
  key: string,
  expectedSizeBytes: number,
  expectedSha256?: string,
): Promise<void> {
  const response = (await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  )) as
    { ContentLength?: number; Metadata?: Record<string, string> } | undefined;

  if (response?.ContentLength !== expectedSizeBytes) {
    throw new Error(
      `Object restore verification failed for ${key}: expected ${expectedSizeBytes} bytes, found ${response?.ContentLength ?? "missing object"}.`,
    );
  }
  if (expectedSha256 && response.Metadata?.sha256 !== expectedSha256) {
    throw new Error(
      `Object restore verification failed for ${key}: sha256 mismatch (expected ${expectedSha256}, found ${response.Metadata?.sha256 ?? "none"}).`,
    );
  }
}

async function main(): Promise<void> {
  const r2Bucket = required("RESTORE_TARGET_R2_BUCKET");
  if (r2Bucket === process.env.R2_BUCKET) {
    throw new Error(
      "RESTORE_TARGET_R2_BUCKET must not be the same as R2_BUCKET - point it at the actual restore target.",
    );
  }
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

  const backedUpObjects = await listB2Objects(b2Client, b2Bucket);
  let restoredCount = 0;
  let skippedCount = 0;

  for (const object of backedUpObjects) {
    let targetKey: string;
    try {
      targetKey = sourceKeyForObjectBackupKey(object.key);
    } catch {
      skippedCount += 1; // not a recognized document/report backup key
      continue;
    }

    const sha256 = await getBackupSha256(b2Client, b2Bucket, object.key);
    await copyObjectToR2(
      b2Client,
      b2Bucket,
      object.key,
      r2Client,
      r2Bucket,
      targetKey,
      sha256,
    );
    await verifyRestoredObject(
      r2Client,
      r2Bucket,
      targetKey,
      object.sizeBytes,
      sha256,
    );
    restoredCount += 1;
  }

  console.log(
    `B2 -> R2 object restore: ${restoredCount} restored, ${skippedCount} skipped (${backedUpObjects.length} total).`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(formatErrorWithCause(error));
    process.exitCode = 1;
  });
}
