import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { assertR2Environment } from "../config/cloud-environment";
import { getDatabase } from "../db/client";
import { backupRuns } from "../db/schema";

// 19.3: how stale the most recent verified backup row may be before the
// settings page stops calling it "recent" - generous margin over the
// nightly 02:00 cron, to catch a workflow that silently stopped running.
const staleAfterMs = 36 * 60 * 60 * 1000;

export type BackupStatus = {
  database: { ranAt: Date; detail: string } | null;
  objects: { ranAt: Date; detail: string } | null;
  stale: boolean;
};

export type StatusCheck = {
  detail: string;
  ok: boolean;
};

export async function checkDatabaseStatus(): Promise<StatusCheck> {
  try {
    await getDatabase().execute(sql`select 1`);
    return { detail: "Connected to the application database.", ok: true };
  } catch (error) {
    return {
      detail:
        error instanceof Error ? error.message : "Database is unreachable.",
      ok: false,
    };
  }
}

// ponytail: config-presence check, not a live round-trip — upgrade to a
// HeadBucket-style call if the storage client grows one cheaply.
export function checkStorageConfiguration(
  environment: Record<string, string | undefined> = process.env,
): StatusCheck {
  try {
    assertR2Environment(environment);
    return { detail: "R2 storage is configured.", ok: true };
  } catch (error) {
    return {
      detail:
        error instanceof Error
          ? error.message
          : "R2 storage is not configured.",
      ok: false,
    };
  }
}

export function statusBadgeTone(ok: boolean): "error" | "success" {
  return ok ? "success" : "error";
}

async function latestBackupRun(
  kind: "database" | "objects",
): Promise<{ ranAt: Date; detail: string } | null> {
  const [row] = await getDatabase()
    .select({ detail: backupRuns.detail, ranAt: backupRuns.ranAt })
    .from(backupRuns)
    .where(eq(backupRuns.kind, kind))
    .orderBy(desc(backupRuns.ranAt))
    .limit(1);
  return row ?? null;
}

// 19.1/19.3: reads only verified-success rows the backup scripts wrote
// (src/server/db/schema.ts backupRuns) - never assumes last night's
// scheduled workflow ran just because it was scheduled to.
export async function checkLastBackupStatus(
  now: Date = new Date(),
): Promise<BackupStatus> {
  const [database, objects] = await Promise.all([
    latestBackupRun("database"),
    latestBackupRun("objects"),
  ]);

  const mostRecent = [database?.ranAt, objects?.ranAt]
    .filter((d): d is Date => d !== undefined && d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const stale =
    !mostRecent || now.getTime() - mostRecent.getTime() > staleAfterMs;

  return { database, objects, stale };
}
