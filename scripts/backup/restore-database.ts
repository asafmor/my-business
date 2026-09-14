/**
 * On-demand disaster-recovery database restore: pick a verified B2 database
 * backup (or use the one named on argv) -> download it -> verify its
 * sha256 -> pg_restore it into an explicit target database -> sanity-check
 * the restored schema. Mirrors dump-database.ts's shape in reverse. Never
 * run in CI; this is a manual/local operator command (see docs/RESTORE.md).
 *
 * 20.2: the exported functions below are the testable units; `main()` wires
 * them together and only runs when this file is executed directly.
 *
 * Safety: the target is always RESTORE_TARGET_DATABASE_URL, never
 * DATABASE_URL or NEON_BACKUP_DATABASE_URL - a restore must never silently
 * overwrite a real database because a familiar env var happened to be set.
 */
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";

import { type BackupKey } from "./layout";
import { redactConnectionString } from "./record-run";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

type S3ClientLike = { send(command: unknown): Promise<unknown> };

export type ListedBackup = { key: string; sizeBytes: number };

// 20.2: list every object under database/, paginating with continuation
// tokens (mirrors listAllObjects in sync-r2-to-b2.ts).
export async function listDatabaseBackups(
  client: S3ClientLike,
  bucket: string,
): Promise<ListedBackup[]> {
  const objects: ListedBackup[] = [];
  let continuationToken: string | undefined;

  do {
    const response = (await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "database/",
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

const dailyKeyPattern = /^database\/daily\/(\d{4}-\d{2}-\d{2})\.dump$/;

// 20.2: "latest verified backup" (SPEC.md #35 step 3) resolves to the most
// recent daily dump - dailies run every night, so they are always the
// freshest available restore point. ISO date strings sort lexicographically,
// so a plain string max works.
export function latestDailyBackupKey(
  backups: ListedBackup[],
): BackupKey | undefined {
  const dailyKeys = backups
    .map((backup) => backup.key)
    .filter((key) => dailyKeyPattern.test(key));
  if (dailyKeys.length === 0) return undefined;
  return dailyKeys.sort().at(-1) as BackupKey;
}

export function resolveBackupKey(
  requested: string | undefined,
  backups: ListedBackup[],
): BackupKey {
  if (requested && requested !== "latest") return requested as BackupKey;
  const latest = latestDailyBackupKey(backups);
  if (!latest) {
    throw new Error("No daily database backups found under database/.");
  }
  return latest;
}

// 20.2: download the dump to a local temp file, streaming rather than
// buffering the whole (potentially large) dump in memory.
export async function downloadDump(
  client: S3ClientLike,
  bucket: string,
  key: BackupKey,
  outFile: string,
): Promise<void> {
  const response = (await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  )) as { Body?: unknown };
  const body = response.Body as
    | NodeJS.ReadableStream
    | { transformToWebStream?: () => ReadableStream }
    | undefined;
  if (!body || typeof (body as NodeJS.ReadableStream).pipe !== "function") {
    throw new Error(`B2 returned an unreadable body for ${key}.`);
  }
  await pipeline(body as NodeJS.ReadableStream, createWriteStream(outFile));
}

export function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

// 20.2: verify against the sha256 dump-database.ts recorded in the object's
// own Metadata at upload time (uploadDump sets Metadata: { sha256 }) -
// simpler and just as authoritative as re-parsing the day's manifest.
export async function verifyDumpSha256(
  client: S3ClientLike,
  bucket: string,
  key: BackupKey,
  filePath: string,
): Promise<void> {
  const response = (await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  )) as { Metadata?: Record<string, string> } | undefined;
  const expected = response?.Metadata?.sha256;
  if (!expected) {
    throw new Error(`No sha256 recorded in B2 metadata for ${key}.`);
  }
  const actual = await sha256File(filePath);
  if (actual !== expected) {
    throw new Error(
      `Checksum mismatch for ${key}: expected ${expected}, downloaded ${actual}.`,
    );
  }
}

// 20.2: same libpq PG*-env-var credential-passing style as runPgDump in
// dump-database.ts - never put the connection string or password on argv.
// --clean --if-exists so restoring into a freshly (re)provisioned database
// or re-running the restore is idempotent.
export function runPgRestore(
  connectionUrl: string,
  dumpFile: string,
  execFileImpl: typeof execFile = execFile,
): Promise<void> {
  const url = new URL(connectionUrl);
  const args = [
    "-h",
    url.hostname,
    "-p",
    url.port || "5432",
    "-U",
    decodeURIComponent(url.username),
    "-d",
    decodeURIComponent(url.pathname.replace(/^\//, "")),
    "--no-password",
    "--clean",
    "--if-exists",
    dumpFile,
  ];
  const env = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.searchParams.get("sslmode") ?? "require",
  };

  return new Promise((resolve, reject) => {
    execFileImpl("pg_restore", args, { env }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// 20.2: a handful of "does this table exist and is it queryable" checks
// against the actual pgTable names in src/server/db/schema.ts - deliberately
// not a full schema diff tool.
export const expectedTables = [
  "documents",
  "document_files",
  "categories",
  "expenses",
  "extractions",
  "processing_tasks",
  "audit_events",
  "reports",
  "backup_runs",
] as const;

type QueryableDatabase = { query(sql: string): Promise<unknown> };

export async function validateRestoredSchema(
  database: QueryableDatabase,
  tables: readonly string[] = expectedTables,
): Promise<void> {
  const missing: string[] = [];
  for (const table of tables) {
    try {
      await database.query(`select 1 from "${table}" limit 1`);
    } catch {
      missing.push(table);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Restored database is missing or has unqueryable tables: ${missing.join(", ")}.`,
    );
  }
}

async function main(): Promise<void> {
  const targetUrl = required("RESTORE_TARGET_DATABASE_URL");
  if (
    targetUrl === process.env.DATABASE_URL ||
    targetUrl === process.env.NEON_BACKUP_DATABASE_URL
  ) {
    throw new Error(
      "RESTORE_TARGET_DATABASE_URL must not be the same as DATABASE_URL or NEON_BACKUP_DATABASE_URL - point it at the actual restore target.",
    );
  }

  const bucket = required("B2_BUCKET");
  const client = new S3Client({
    credentials: {
      accessKeyId: required("B2_ACCESS_KEY_ID"),
      secretAccessKey: required("B2_SECRET_ACCESS_KEY"),
    },
    endpoint: required("B2_ENDPOINT"),
    forcePathStyle: true,
    region: required("B2_REGION"),
  });

  const requested = process.argv[2];
  const backups = await listDatabaseBackups(client, bucket);
  const key = resolveBackupKey(requested, backups);
  const outFile = join(tmpdir(), `my-business-restore-${Date.now()}.dump`);

  try {
    await downloadDump(client, bucket, key, outFile);
    await verifyDumpSha256(client, bucket, key, outFile);
    await runPgRestore(targetUrl, outFile);

    const pool = new Pool({ connectionString: targetUrl, max: 1 });
    try {
      await validateRestoredSchema(pool);
    } finally {
      await pool.end();
    }

    console.log(
      `Restored ${key} into the target database and validated schema.`,
    );
  } finally {
    rmSync(outFile, { force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(
      redactConnectionString(
        error instanceof Error ? error.message : "Restore failed.",
      ),
    );
    process.exitCode = 1;
  });
}
