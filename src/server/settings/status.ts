import "server-only";

import { sql } from "drizzle-orm";

import { assertR2Environment } from "../config/cloud-environment";
import { getDatabase } from "../db/client";

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
