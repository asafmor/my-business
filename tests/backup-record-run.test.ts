import { describe, expect, it, vi } from "vitest";

vi.mock("../src/server/db/schema", () => ({
  backupRuns: { kind: "backup_runs.kind" },
}));

import {
  recordBackupRun,
  redactConnectionString,
} from "../scripts/backup/record-run";

describe("recordBackupRun", () => {
  it("inserts exactly one row into backupRuns", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn(() => ({ values }));

    await recordBackupRun(
      { insert },
      {
        detail: "2 copied, 3 already backed up",
        kind: "objects",
        ranAt: new Date("2026-09-15T02:00:00Z"),
      },
    );

    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith({
      detail: "2 copied, 3 already backed up",
      kind: "objects",
      ranAt: new Date("2026-09-15T02:00:00Z"),
    });
  });
});

describe("redactConnectionString", () => {
  it("strips credentials from a postgres connection string", () => {
    expect(
      redactConnectionString(
        "connect failed: postgres://baduser:s3cr3tpass@host:5432/db is unreachable",
      ),
    ).toBe("connect failed: postgres://[redacted]@host:5432/db is unreachable");
  });

  it("leaves messages with no credentials untouched", () => {
    expect(redactConnectionString("getaddrinfo ENOTFOUND host")).toBe(
      "getaddrinfo ENOTFOUND host",
    );
  });
});
