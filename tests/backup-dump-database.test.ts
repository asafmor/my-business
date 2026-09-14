import { describe, expect, it, vi } from "vitest";

vi.mock("../src/server/db/schema", () => ({
  backupRuns: { kind: "backup_runs.kind" },
}));

import {
  backupKeysForDate,
  runPgDump,
  uploadDump,
  verifyUpload,
} from "../scripts/backup/dump-database";

describe("backupKeysForDate", () => {
  it("always includes the daily key, plus weekly on Monday and monthly on the 1st", () => {
    // Monday, September 14 2026 - not the 1st of the month.
    expect(backupKeysForDate(new Date(Date.UTC(2026, 8, 14)))).toEqual([
      "database/daily/2026-09-14.dump",
      "database/weekly/2026-W38.dump",
    ]);

    // Tuesday, September 1 2026 - not a Monday.
    expect(backupKeysForDate(new Date(Date.UTC(2026, 8, 1)))).toEqual([
      "database/daily/2026-09-01.dump",
      "database/monthly/2026-09.dump",
    ]);

    // Neither a Monday nor the 1st.
    expect(backupKeysForDate(new Date(Date.UTC(2026, 8, 16)))).toEqual([
      "database/daily/2026-09-16.dump",
    ]);
  });
});

describe("runPgDump", () => {
  it("resolves when pg_dump exits successfully", async () => {
    const execFileImpl = vi.fn((_cmd, _args, _opts, callback) => {
      callback(null);
    }) as unknown as typeof import("node:child_process").execFile;

    await expect(
      runPgDump(
        "postgres://user:secret@host:5432/dbname?sslmode=require",
        "/tmp/out.dump",
        execFileImpl,
      ),
    ).resolves.toBeUndefined();
  });

  it("throws instead of continuing when pg_dump fails (17.5)", async () => {
    const execFileImpl = vi.fn((_cmd, _args, _opts, callback) => {
      callback(new Error("pg_dump: error: connection failed"));
    }) as unknown as typeof import("node:child_process").execFile;

    await expect(
      runPgDump(
        "postgres://user:secret@host:5432/dbname",
        "/tmp/out.dump",
        execFileImpl,
      ),
    ).rejects.toThrow("connection failed");
  });

  it("never puts the connection string or password on argv", async () => {
    const execFileImpl = vi.fn((_cmd, args, _opts, callback) => {
      expect(args).not.toContain("postgres://user:secret@host:5432/dbname");
      expect(JSON.stringify(args)).not.toContain("secret");
      callback(null);
    }) as unknown as typeof import("node:child_process").execFile;

    await runPgDump(
      "postgres://user:secret@host:5432/dbname",
      "/tmp/out.dump",
      execFileImpl,
    );
  });
});

describe("uploadDump", () => {
  it("throws instead of continuing when the B2 upload fails (17.5)", async () => {
    const send = vi.fn().mockRejectedValue(new Error("network error"));

    await expect(
      uploadDump(
        { send },
        "bucket",
        "database/daily/2026-09-14.dump" as never,
        __filename,
        "a".repeat(64),
      ),
    ).rejects.toThrow("network error");
  });
});

describe("verifyUpload", () => {
  const key = "database/daily/2026-09-14.dump" as never;

  it("passes when the uploaded object exists with the expected size", async () => {
    const send = vi.fn().mockResolvedValue({ ContentLength: 1024 });

    await expect(
      verifyUpload({ send }, "bucket", key, 1024),
    ).resolves.toBeUndefined();
  });

  it("throws when the object is missing (17.5)", async () => {
    const send = vi.fn().mockResolvedValue(undefined);

    await expect(verifyUpload({ send }, "bucket", key, 1024)).rejects.toThrow(
      "missing object",
    );
  });

  it("throws when the reported size does not match (17.5)", async () => {
    const send = vi.fn().mockResolvedValue({ ContentLength: 512 });

    await expect(verifyUpload({ send }, "bucket", key, 1024)).rejects.toThrow(
      "expected 1024 bytes, found 512",
    );
  });
});
