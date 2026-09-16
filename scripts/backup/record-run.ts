/**
 * 19.1/19.3: after a backup script's own verification step passes, record
 * one row in `backup_runs` via NEON_BACKUP_DATABASE_URL (the same
 * underlying Neon database the app reads through DATABASE_URL, just a
 * separate backup-only credential). A row's mere existence means "verified
 * success" — no "failure" rows are ever written; a missing/stale row is
 * itself the signal (see src/server/settings/status.ts).
 *
 * 19.4: connection errors from `pg` can in principle echo the connection
 * string (credentials included) in `.message` - redact defensively before
 * anything reaches console.error.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { backupRuns } from "../../src/server/db/schema";

export type BackupRunRow = {
  kind: "database" | "objects" | "restore_test";
  ranAt: Date;
  detail: string;
};

type InsertableDatabase = {
  insert: (table: typeof backupRuns) => {
    values: (row: BackupRunRow) => Promise<unknown>;
  };
};

export async function recordBackupRun(
  database: InsertableDatabase,
  row: BackupRunRow,
): Promise<void> {
  await database.insert(backupRuns).values(row);
}

// Strips any `scheme://user:pass@host` credential pair out of a message
// before it is logged or rethrown.
export function redactConnectionString(message: string): string {
  return message.replace(
    /[a-z][a-z0-9+.-]*:\/\/[^\s@/]+@/gi,
    (match) => `${match.slice(0, match.indexOf("://") + 3)}[redacted]@`,
  );
}

// Drizzle wraps driver errors in a DrizzleQueryError whose own .message is
// just "Failed query: ...\nparams: ..." - the actual root cause (e.g. a
// missing table/enum, a permission error) lives on .cause and was being
// silently dropped by every backup script's top-level catch. Walk the
// .cause chain so logs show what actually failed.
export function formatErrorWithCause(error: unknown): string {
  const messages: string[] = [];
  for (let current: unknown = error; current instanceof Error; ) {
    messages.push(current.message);
    current = current.cause;
  }
  if (messages.length === 0) messages.push(String(error));
  return redactConnectionString(messages.join(" | caused by: "));
}

// Opens a short-lived Pool against NEON_BACKUP_DATABASE_URL, runs `fn`, and
// always closes the pool - errors are redacted before they propagate.
export async function withBackupRunRecorder<T>(
  connectionString: string,
  fn: (database: InsertableDatabase) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ connectionString, max: 1 });
  try {
    return await fn(drizzle(pool));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redactConnectionString(message), { cause: error });
  } finally {
    await pool.end();
  }
}
