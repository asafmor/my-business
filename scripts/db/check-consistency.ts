/**
 * Maintenance consistency verifier (SPEC.md #35): for every document_files
 * row, check its object exists in R2 with a matching sha256, optionally
 * check a backup copy exists in B2, and report R2 objects with no matching
 * document_files row. Read-only. Safe to run against Development.
 *
 * Usage: npm run db:check-consistency
 *
 * 20.4: the exported functions below are the testable units; `main()` wires
 * them together against real DATABASE_URL/R2_*(/B2_*) and only runs when
 * this file is executed directly.
 */
import {
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { fileURLToPath } from "node:url";

import { objectBackupKeyForSourceKey } from "../backup/layout";
import {
  assertDatabaseEnvironment,
  assertR2Environment,
} from "@/server/config/cloud-environment";
import { documentFiles } from "@/server/db/schema";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

type S3ClientLike = { send(command: unknown): Promise<unknown> };

export type DocumentFileRow = {
  documentId: string;
  objectKey: string;
  sha256: string;
};

export type ObjectCheckResult =
  | { objectKey: string; status: "ok" }
  | { objectKey: string; status: "missing" }
  | {
      objectKey: string;
      status: "sha256-mismatch";
      foundSha256: string | undefined;
    };

async function headSha256(
  client: S3ClientLike,
  bucket: string,
  key: string,
): Promise<{ found: boolean; sha256: string | undefined }> {
  try {
    const response = (await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    )) as { Metadata?: Record<string, string> } | undefined;
    return { found: true, sha256: response?.Metadata?.sha256 };
  } catch (error) {
    const response = error as {
      $metadata?: { httpStatusCode?: number };
      name?: string;
    };
    if (
      response?.$metadata?.httpStatusCode === 404 ||
      response?.name === "NoSuchKey" ||
      response?.name === "NotFound"
    ) {
      return { found: false, sha256: undefined };
    }
    throw error;
  }
}

// 20.4 checks 1+2: every document_files row's object exists in R2, and its
// stored sha256 matches. These are the two required checks - a failure here
// fails the whole run.
export async function checkDocumentFilesAgainstR2(
  client: S3ClientLike,
  bucket: string,
  rows: DocumentFileRow[],
): Promise<ObjectCheckResult[]> {
  const results: ObjectCheckResult[] = [];
  for (const row of rows) {
    const { found, sha256 } = await headSha256(client, bucket, row.objectKey);
    if (!found) {
      results.push({ objectKey: row.objectKey, status: "missing" });
    } else if (sha256 !== row.sha256) {
      results.push({
        objectKey: row.objectKey,
        status: "sha256-mismatch",
        foundSha256: sha256,
      });
    } else {
      results.push({ objectKey: row.objectKey, status: "ok" });
    }
  }
  return results;
}

// 20.4 check 3: a required original also exists in B2 (skippable - only
// runs when B2 credentials happen to be present in the environment; the
// deployed app never receives them per SPEC.md #45).
export async function checkDocumentFilesAgainstB2(
  client: S3ClientLike,
  bucket: string,
  rows: DocumentFileRow[],
): Promise<ObjectCheckResult[]> {
  const results: ObjectCheckResult[] = [];
  for (const row of rows) {
    let backupKey: string;
    try {
      backupKey = objectBackupKeyForSourceKey(row.objectKey);
    } catch {
      results.push({ objectKey: row.objectKey, status: "missing" });
      continue;
    }
    const { found } = await headSha256(client, bucket, backupKey);
    results.push({
      objectKey: row.objectKey,
      status: found ? "ok" : "missing",
    });
  }
  return results;
}

// 20.4 check 4: R2 objects with no matching document_files row.
export async function findOrphanedR2Objects(
  client: S3ClientLike,
  bucket: string,
  knownObjectKeys: ReadonlySet<string>,
): Promise<string[]> {
  const orphans: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = (await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    )) as {
      Contents?: { Key?: string }[];
      IsTruncated?: boolean;
      NextContinuationToken?: string;
    };

    for (const item of response.Contents ?? []) {
      if (item.Key !== undefined && !knownObjectKeys.has(item.Key)) {
        orphans.push(item.Key);
      }
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return orphans;
}

function hasB2Credentials(environment: NodeJS.ProcessEnv): boolean {
  return Boolean(
    environment.B2_ENDPOINT &&
    environment.B2_REGION &&
    environment.B2_ACCESS_KEY_ID &&
    environment.B2_SECRET_ACCESS_KEY &&
    environment.B2_BUCKET,
  );
}

async function main(): Promise<void> {
  assertDatabaseEnvironment(process.env);
  assertR2Environment(process.env);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const db = drizzle(pool);
  let exitCode = 0;

  try {
    const rows = await db
      .select({
        documentId: documentFiles.documentId,
        objectKey: documentFiles.objectKey,
        sha256: documentFiles.sha256,
      })
      .from(documentFiles);

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

    console.log(`Checking ${rows.length} document_files row(s) against R2...`);
    const r2Results = await checkDocumentFilesAgainstR2(
      r2Client,
      r2Bucket,
      rows,
    );
    const r2Failures = r2Results.filter((result) => result.status !== "ok");
    for (const failure of r2Failures) {
      console.log(`  FAIL ${failure.objectKey}: ${failure.status}`);
    }
    console.log(
      `  ${r2Results.length - r2Failures.length}/${r2Results.length} ok, ${r2Failures.length} failed.`,
    );
    if (r2Failures.length > 0) exitCode = 1;

    if (hasB2Credentials(process.env)) {
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
      console.log("Checking B2 backup coverage...");
      const b2Results = await checkDocumentFilesAgainstB2(
        b2Client,
        b2Bucket,
        rows,
      );
      const b2Failures = b2Results.filter((result) => result.status !== "ok");
      for (const failure of b2Failures) {
        console.log(`  MISSING FROM B2 ${failure.objectKey}`);
      }
      console.log(
        `  ${b2Results.length - b2Failures.length}/${b2Results.length} backed up in B2.`,
      );
    } else {
      console.log("Checking B2 backup coverage... skipped: no B2 credentials.");
    }

    const knownKeys = new Set(rows.map((row) => row.objectKey));
    const orphans = await findOrphanedR2Objects(r2Client, r2Bucket, knownKeys);
    console.log(
      `Orphaned R2 objects (no document_files row): ${orphans.length}`,
    );
    for (const key of orphans) console.log(`  ${key}`);

    console.log(
      exitCode === 0 ? "Consistency check: PASS" : "Consistency check: FAIL",
    );
  } finally {
    await pool.end();
  }

  process.exitCode = exitCode;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Consistency check failed.",
    );
    process.exitCode = 1;
  });
}
