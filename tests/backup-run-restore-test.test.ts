import { describe, expect, it, vi } from "vitest";

vi.mock("../src/server/db/schema", () => ({
  backupRuns: { kind: "backup_runs.kind" },
}));

import {
  checkForeignKeysConsistent,
  checkRepresentativeRecordsReadable,
  foreignKeyRelations,
} from "../scripts/backup/run-restore-test";

describe("checkRepresentativeRecordsReadable", () => {
  it("passes when every representative table is queryable, even if empty", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await expect(
      checkRepresentativeRecordsReadable({ query }, ["documents", "expenses"]),
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("throws when a representative table query fails", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("relation does not exist"));

    await expect(
      checkRepresentativeRecordsReadable({ query }, ["documents", "expenses"]),
    ).rejects.toThrow("relation does not exist");
  });
});

describe("checkForeignKeysConsistent", () => {
  it("passes when no orphan rows are found", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ count: "0" }] });
    await expect(
      checkForeignKeysConsistent({ query }, foreignKeyRelations),
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(foreignKeyRelations.length);
  });

  it("throws naming the relation with orphan rows", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "3" }] });

    await expect(
      checkForeignKeysConsistent({ query }, [
        foreignKeyRelations[0]!,
        foreignKeyRelations[1]!,
      ]),
    ).rejects.toThrow(/expenses\.document_id -> documents\.id \(3 orphan/);
  });
});
