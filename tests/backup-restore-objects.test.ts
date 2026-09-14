import { describe, expect, it, vi } from "vitest";

vi.mock("../src/server/db/schema", () => ({
  backupRuns: { kind: "backup_runs.kind" },
}));

import {
  copyObjectToR2,
  getBackupSha256,
  listB2Objects,
  verifyRestoredObject,
} from "../scripts/backup/restore-objects";

const documentId = "de305d54-75b4-431b-adb2-eb6b9e546013";

describe("listB2Objects", () => {
  it("paginates with continuation tokens instead of assuming a single page", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Contents: [
          { Key: `objects/documents/${documentId}/original`, Size: 10 },
        ],
        IsTruncated: true,
        NextContinuationToken: "token-1",
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: "objects/reports/2026/09/x.pdf", Size: 20 }],
        IsTruncated: false,
      });

    await expect(listB2Objects({ send }, "bucket")).resolves.toEqual([
      { key: `objects/documents/${documentId}/original`, sizeBytes: 10 },
      { key: "objects/reports/2026/09/x.pdf", sizeBytes: 20 },
    ]);
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe("getBackupSha256", () => {
  it("reads the sha256 recorded in B2 object Metadata", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ Metadata: { sha256: "a".repeat(64) } });

    await expect(
      getBackupSha256(
        { send },
        "bucket",
        `objects/documents/${documentId}/original`,
      ),
    ).resolves.toBe("a".repeat(64));
  });

  it("returns undefined when no sha256 is recorded", async () => {
    const send = vi.fn().mockResolvedValue({ Metadata: {} });

    await expect(
      getBackupSha256(
        { send },
        "bucket",
        `objects/documents/${documentId}/original`,
      ),
    ).resolves.toBeUndefined();
  });
});

describe("copyObjectToR2", () => {
  it("streams the B2 body to R2 and preserves the sha256 metadata", async () => {
    const body = new Uint8Array([1, 2, 3]);
    const b2Send = vi.fn().mockResolvedValue({
      Body: { transformToByteArray: async () => body },
      ContentType: "application/octet-stream",
    });
    const r2Send = vi.fn().mockResolvedValue({});

    await copyObjectToR2(
      { send: b2Send },
      "b2-bucket",
      `objects/documents/${documentId}/original`,
      { send: r2Send },
      "r2-bucket",
      `documents/${documentId}/original`,
      "a".repeat(64),
    );

    expect(r2Send).toHaveBeenCalledTimes(1);
    const command = r2Send.mock.calls[0][0] as {
      input: { Body: unknown; Key: string; Metadata?: Record<string, string> };
    };
    expect(command.input.Body).toBe(body);
    expect(command.input.Key).toBe(`documents/${documentId}/original`);
    expect(command.input.Metadata).toEqual({ sha256: "a".repeat(64) });
  });
});

describe("verifyRestoredObject", () => {
  it("passes when size and sha256 match", async () => {
    const send = vi.fn().mockResolvedValue({
      ContentLength: 1024,
      Metadata: { sha256: "a".repeat(64) },
    });

    await expect(
      verifyRestoredObject(
        { send },
        "bucket",
        "documents/a/original",
        1024,
        "a".repeat(64),
      ),
    ).resolves.toBeUndefined();
  });

  it("fails when the restored object is missing", async () => {
    const send = vi.fn().mockResolvedValue(undefined);

    await expect(
      verifyRestoredObject({ send }, "bucket", "documents/a/original", 1024),
    ).rejects.toThrow("missing object");
  });

  it("fails when size does not match", async () => {
    const send = vi.fn().mockResolvedValue({ ContentLength: 512 });

    await expect(
      verifyRestoredObject({ send }, "bucket", "documents/a/original", 1024),
    ).rejects.toThrow("expected 1024 bytes, found 512");
  });

  it("fails when sha256 does not match", async () => {
    const send = vi.fn().mockResolvedValue({
      ContentLength: 1024,
      Metadata: { sha256: "b".repeat(64) },
    });

    await expect(
      verifyRestoredObject(
        { send },
        "bucket",
        "documents/a/original",
        1024,
        "a".repeat(64),
      ),
    ).rejects.toThrow("sha256 mismatch");
  });
});
