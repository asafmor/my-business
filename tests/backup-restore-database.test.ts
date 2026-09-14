import { describe, expect, it, vi } from "vitest";
import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("../src/server/db/schema", () => ({
  backupRuns: { kind: "backup_runs.kind" },
}));

import {
  latestDailyBackupKey,
  resolveBackupKey,
  runPgRestore,
  sha256File,
  validateRestoredSchema,
  verifyDumpSha256,
} from "../scripts/backup/restore-database";

describe("latestDailyBackupKey / resolveBackupKey", () => {
  const backups = [
    { key: "database/daily/2026-09-10.dump", sizeBytes: 1 },
    { key: "database/daily/2026-09-14.dump", sizeBytes: 1 },
    { key: "database/weekly/2026-W37.dump", sizeBytes: 1 },
    { key: "database/monthly/2026-09.dump", sizeBytes: 1 },
  ];

  it("picks the most recent daily key", () => {
    expect(latestDailyBackupKey(backups)).toBe(
      "database/daily/2026-09-14.dump",
    );
  });

  it("returns undefined when there are no daily backups", () => {
    expect(latestDailyBackupKey([])).toBeUndefined();
  });

  it("resolves 'latest' (or no argument) to the newest daily key", () => {
    expect(resolveBackupKey(undefined, backups)).toBe(
      "database/daily/2026-09-14.dump",
    );
    expect(resolveBackupKey("latest", backups)).toBe(
      "database/daily/2026-09-14.dump",
    );
  });

  it("uses an explicit key as-is", () => {
    expect(resolveBackupKey("database/weekly/2026-W37.dump", backups)).toBe(
      "database/weekly/2026-W37.dump",
    );
  });

  it("throws when 'latest' is requested but no daily backups exist", () => {
    expect(() => resolveBackupKey("latest", [])).toThrow(
      "No daily database backups found",
    );
  });
});

describe("verifyDumpSha256", () => {
  const filePath = join(tmpdir(), `restore-test-${Date.now()}.dump`);

  it("passes when the downloaded file's sha256 matches B2 metadata", async () => {
    writeFileSync(filePath, "hello world");
    const expected = await sha256File(filePath);
    const send = vi.fn().mockResolvedValue({ Metadata: { sha256: expected } });

    await expect(
      verifyDumpSha256(
        { send },
        "bucket",
        "database/daily/x.dump" as never,
        filePath,
      ),
    ).resolves.toBeUndefined();
    rmSync(filePath, { force: true });
  });

  it("throws when no sha256 is recorded in B2 metadata", async () => {
    writeFileSync(filePath, "hello world");
    const send = vi.fn().mockResolvedValue({ Metadata: {} });

    await expect(
      verifyDumpSha256(
        { send },
        "bucket",
        "database/daily/x.dump" as never,
        filePath,
      ),
    ).rejects.toThrow("No sha256 recorded");
    rmSync(filePath, { force: true });
  });

  it("throws when the sha256 does not match", async () => {
    writeFileSync(filePath, "hello world");
    const send = vi
      .fn()
      .mockResolvedValue({ Metadata: { sha256: "mismatch" } });

    await expect(
      verifyDumpSha256(
        { send },
        "bucket",
        "database/daily/x.dump" as never,
        filePath,
      ),
    ).rejects.toThrow("Checksum mismatch");
    rmSync(filePath, { force: true });
  });
});

describe("runPgRestore", () => {
  it("never puts the connection string or password on argv", async () => {
    const execFileImpl = vi.fn((_cmd, args, _opts, callback) => {
      expect(args).not.toContain("postgres://user:secret@host:5432/dbname");
      expect(JSON.stringify(args)).not.toContain("secret");
      callback(null);
    }) as unknown as typeof import("node:child_process").execFile;

    await runPgRestore(
      "postgres://user:secret@host:5432/dbname",
      "/tmp/x.dump",
      execFileImpl,
    );
  });

  it("throws instead of continuing when pg_restore fails", async () => {
    const execFileImpl = vi.fn((_cmd, _args, _opts, callback) => {
      callback(new Error("pg_restore: error: connection failed"));
    }) as unknown as typeof import("node:child_process").execFile;

    await expect(
      runPgRestore(
        "postgres://user:secret@host:5432/dbname",
        "/tmp/x.dump",
        execFileImpl,
      ),
    ).rejects.toThrow("connection failed");
  });
});

describe("validateRestoredSchema", () => {
  it("passes when every table is queryable", async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    await expect(
      validateRestoredSchema({ query }, ["documents", "expenses"]),
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("throws naming the tables that failed", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("relation does not exist"));

    await expect(
      validateRestoredSchema({ query }, ["documents", "expenses"]),
    ).rejects.toThrow("expenses");
  });
});
