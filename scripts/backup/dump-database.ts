/**
 * Nightly database backup: pg_dump (custom format) -> checksum -> upload to
 * B2 -> verify. Run via `npm run backup:dump-database` (see backup.yml).
 *
 * 17.1-17.3: the exported functions below are the testable units; `main()`
 * wires them together and only runs when this file is executed directly, so
 * tests can import the functions without triggering a real backup.
 */
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type BackupKey,
  databaseDailyBackupKey,
  databaseMonthlyBackupKey,
  databaseWeeklyBackupKey,
  manifestBackupKey,
} from "./layout";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

// Which database backup keys today's run must write: always daily, plus
// weekly on the ISO week's Monday (isoWeek in layout.ts is Monday-based) and
// monthly on the 1st of the month.
export function backupKeysForDate(date: Date): BackupKey[] {
  const keys = [databaseDailyBackupKey(date)];
  if (date.getUTCDay() === 1) keys.push(databaseWeeklyBackupKey(date));
  if (date.getUTCDate() === 1) keys.push(databaseMonthlyBackupKey(date));
  return keys;
}

// pg_dump takes the connection string as an argument, but a URI with an
// embedded password would then show up in `ps` output and CI logs. Instead
// we pass the pieces via libpq's standard PG* environment variables (which
// pg_dump reads and never echoes) and keep argv free of credentials.
export function runPgDump(
  connectionUrl: string,
  outFile: string,
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
    "-Fc",
    "-f",
    outFile,
    "--no-password",
  ];
  const env = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.searchParams.get("sslmode") ?? "require",
  };

  return new Promise((resolve, reject) => {
    execFileImpl("pg_dump", args, { env }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
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

type S3ClientLike = { send(command: unknown): Promise<unknown> };

export async function uploadDump(
  client: S3ClientLike,
  bucket: string,
  key: BackupKey,
  filePath: string,
  sha256: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Body: createReadStream(filePath),
      Bucket: bucket,
      ContentType: "application/octet-stream",
      Key: key,
      Metadata: { sha256 },
    }),
  );
}

export async function verifyUpload(
  client: S3ClientLike,
  bucket: string,
  key: BackupKey,
  expectedSizeBytes: number,
): Promise<void> {
  const response = (await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  )) as { ContentLength?: number } | undefined;
  const actualSizeBytes = response?.ContentLength;
  if (actualSizeBytes !== expectedSizeBytes) {
    throw new Error(
      `Backup verification failed for ${key}: expected ${expectedSizeBytes} bytes, found ${actualSizeBytes ?? "missing object"}.`,
    );
  }
}

async function pgDumpVersion(
  execFileImpl: typeof execFile = execFile,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFileImpl("pg_dump", ["--version"], (error, stdout) => {
      resolve(error ? undefined : stdout.trim());
    });
  });
}

async function main(): Promise<void> {
  const connectionUrl = required("NEON_BACKUP_DATABASE_URL");
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

  const now = new Date();
  const outFile = join(tmpdir(), `my-business-backup-${randomUUID()}.dump`);

  try {
    await runPgDump(connectionUrl, outFile);
    const sha256 = await sha256File(outFile);
    const sizeBytes = statSync(outFile).size;
    const keys = backupKeysForDate(now);

    for (const key of keys) {
      await uploadDump(client, bucket, key, outFile, sha256);
      await verifyUpload(client, bucket, key, sizeBytes);
    }

    const manifest = {
      generatedAt: now.toISOString(),
      keys,
      pgDumpVersion: await pgDumpVersion(),
      sha256,
      sizeBytes,
    };
    await client.send(
      new PutObjectCommand({
        Body: JSON.stringify(manifest, null, 2),
        Bucket: bucket,
        ContentType: "application/json",
        Key: manifestBackupKey(now),
      }),
    );

    console.log(`Backed up database to: ${keys.join(", ")}`);
  } finally {
    rmSync(outFile, { force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Backup failed.");
    process.exitCode = 1;
  });
}
