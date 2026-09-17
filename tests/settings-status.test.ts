import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db/client", () => ({ getDatabase: vi.fn() }));
vi.mock("../src/server/observability/logger", () => ({ logError: vi.fn() }));
vi.mock("../src/server/db/schema", () => ({
  backupRuns: {
    detail: "backup_runs.detail",
    kind: "backup_runs.kind",
    ranAt: "backup_runs.ran_at",
  },
}));

import { getDatabase } from "../src/server/db/client";
import { logError } from "../src/server/observability/logger";
import { developmentR2Bucket } from "../src/server/config/cloud-environment";
import {
  backupBadgeTone,
  checkDatabaseStatus,
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

describe("checkDatabaseStatus", () => {
  it("keeps the driver's error text out of the page and puts it in the log", async () => {
    // A real connect failure names the pooler host, and often the user and
    // database with it. Settings renders into HTML a browser can read.
    const failure = new Error(
      "getaddrinfo ENOTFOUND ep-still-sun-1234-pooler.eu-central-1.aws.neon.tech",
    );
    vi.mocked(getDatabase).mockImplementation((() => ({
      execute: () => Promise.reject(failure),
    })) as never);

    const result = await checkDatabaseStatus();

    expect(result.ok).toBe(false);
    expect(result.detail).not.toContain("neon.tech");
    expect(result.detail).toBe(
      "מסד הנתונים של היישום לא ענה. יש לבדוק את יומני השרת.",
    );
    expect(logError).toHaveBeenCalledWith(
      "settings.database_check_failed",
      failure,
    );
  });
});

describe("backupBadgeTone", () => {
  const run = {
    detail: "ok",
    ranAt: new Date("2026-09-15T02:05:00Z"),
    stale: false,
  };

  it("is neutral when no backup has ever been recorded", () => {
    expect(backupBadgeTone(null)).toBe("neutral");
  });

  // Stale is the one thing on Settings that asks for a person, so it is the
  // one thing that gets cream and the "!" glyph rather than a green tick.
  it("warns rather than fails when a recorded backup has gone stale", () => {
    expect(backupBadgeTone({ ...run, stale: true })).toBe("warning");
  });

  it("is success when a recorded backup is recent", () => {
    expect(backupBadgeTone(run)).toBe("success");
  });
});

describe("checkStorageConfiguration", () => {
  it("reports ok when required R2 variables are present and valid", () => {
    expect(checkStorageConfiguration(configuredEnvironment)).toEqual({
      detail: "אחסון R2 מוגדר.",
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

    expect(result.database).toMatchObject({ detail: "db ok", stale: false });
    expect(result.objects).toMatchObject({
      detail: "objects ok",
      stale: false,
    });
  });

  it("is stale when the last row of that kind is more than 36 hours old", async () => {
    vi.mocked(getDatabase).mockImplementation(
      fakeDatabaseReturning([
        [{ detail: "db old", ranAt: new Date("2026-09-13T02:05:00Z") }],
        [],
      ]) as never,
    );

    const result = await checkLastBackupStatus(now);

    expect(result.database?.stale).toBe(true);
    expect(result.objects).toBeNull();
  });

  // The reason each kind is timed on its own: nightly dumps kept running
  // while the object mirror stopped, and one shared flag hid it.
  it("does not let a fresh dump cover for a stalled object mirror", async () => {
    vi.mocked(getDatabase).mockImplementation(
      fakeDatabaseReturning([
        [{ detail: "db ok", ranAt: new Date("2026-09-15T02:05:00Z") }],
        [{ detail: "objects old", ranAt: new Date("2026-09-12T02:10:00Z") }],
      ]) as never,
    );

    const result = await checkLastBackupStatus(now);

    expect(result.database?.stale).toBe(false);
    expect(result.objects?.stale).toBe(true);
  });

  it("records nothing when no row has ever been written", async () => {
    vi.mocked(getDatabase).mockImplementation(
      fakeDatabaseReturning([[], []]) as never,
    );

    const result = await checkLastBackupStatus(now);

    expect(result.database).toBeNull();
    expect(result.objects).toBeNull();
  });
});
