import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db/client", () => ({ getDatabase: vi.fn() }));
vi.mock("../src/server/db/schema", () => ({
  backupRuns: {
    detail: "backup_runs.detail",
    kind: "backup_runs.kind",
    ranAt: "backup_runs.ran_at",
  },
}));

import { getDatabase } from "../src/server/db/client";
import { developmentR2Bucket } from "../src/server/config/cloud-environment";
import {
  checkLastBackupStatus,
  checkStorageConfiguration,
  statusBadgeTone,
} from "../src/server/settings/status";

// checkLastBackupStatus queries "database" then "objects" (Promise.all
// evaluates array elements in order, and each latestBackupRun() call is
// synchronous up to its final `limit()` promise) - so a queue of two
// canned result rows, consumed in call order, is enough to stand in for a
// real per-kind WHERE clause.
function fakeDatabaseReturning(rowsInCallOrder: unknown[][]) {
  let call = 0;
  return () => {
    const rows = rowsInCallOrder[call] ?? [];
    call += 1;
    const chain: Record<string, unknown> = {
      from: () => chain,
      limit: () => Promise.resolve(rows),
      orderBy: () => chain,
      select: () => chain,
      where: () => chain,
    };
    return chain;
  };
}

const configuredEnvironment = {
  APP_ENV: "development",
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: developmentR2Bucket,
};

describe("statusBadgeTone", () => {
  it("maps ok to success and not-ok to error", () => {
    expect(statusBadgeTone(true)).toBe("success");
    expect(statusBadgeTone(false)).toBe("error");
  });
});

describe("checkStorageConfiguration", () => {
  it("reports ok when required R2 variables are present and valid", () => {
    expect(checkStorageConfiguration(configuredEnvironment)).toEqual({
      detail: "R2 storage is configured.",
      ok: true,
    });
  });

  it("reports not ok with a reason when variables are missing", () => {
    const result = checkStorageConfiguration({ APP_ENV: "development" });

    expect(result.ok).toBe(false);
    expect(result.detail).toContain("Missing R2 variables");
  });
});

describe("checkLastBackupStatus", () => {
  const now = new Date("2026-09-15T12:00:00Z");

  it("is not stale when both kinds have a recent row", async () => {
    vi.mocked(getDatabase).mockImplementation(
      fakeDatabaseReturning([
        [{ detail: "db ok", ranAt: new Date("2026-09-15T02:05:00Z") }],
        [{ detail: "objects ok", ranAt: new Date("2026-09-15T02:10:00Z") }],
      ]) as never,
    );

    const result = await checkLastBackupStatus(now);

    expect(result.stale).toBe(false);
    expect(result.database?.detail).toBe("db ok");
    expect(result.objects?.detail).toBe("objects ok");
  });

  it("is stale when the most recent row is more than 36 hours old", async () => {
    vi.mocked(getDatabase).mockImplementation(
      fakeDatabaseReturning([
        [{ detail: "db old", ranAt: new Date("2026-09-13T02:05:00Z") }],
        [],
      ]) as never,
    );

    const result = await checkLastBackupStatus(now);

    expect(result.stale).toBe(true);
  });

  it("is stale when no row has ever been recorded", async () => {
    vi.mocked(getDatabase).mockImplementation(
      fakeDatabaseReturning([[], []]) as never,
    );

    const result = await checkLastBackupStatus(now);

    expect(result.stale).toBe(true);
    expect(result.database).toBeNull();
    expect(result.objects).toBeNull();
  });
});
