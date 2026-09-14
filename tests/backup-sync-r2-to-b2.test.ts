import { describe, expect, it, vi } from "vitest";

import {
  checkB2Copy,
  copyObjectToB2,
  getSourceSha256,
  listAllObjects,
  verifyB2Copy,
} from "../scripts/backup/sync-r2-to-b2";

const documentId = "de305d54-75b4-431b-adb2-eb6b9e546013";
const backupKey = `objects/documents/${documentId}/original` as never;

describe("listAllObjects", () => {
  it("paginates with continuation tokens instead of assuming a single page", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Contents: [{ Key: "documents/a/original", Size: 10 }],
        IsTruncated: true,
        NextContinuationToken: "token-1",
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: "documents/b/original", Size: 20 }],
        IsTruncated: false,
      });

    await expect(listAllObjects({ send }, "bucket")).resolves.toEqual([
      { key: "documents/a/original", sizeBytes: 10 },
      { key: "documents/b/original", sizeBytes: 20 },
    ]);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("skips entries missing a key or size", async () => {
    const send = vi.fn().mockResolvedValue({
      Contents: [{ Key: "documents/a/original" }, { Size: 10 }],
      IsTruncated: false,
    });

    await expect(listAllObjects({ send }, "bucket")).resolves.toEqual([]);
  });
});

describe("getSourceSha256", () => {
  it("reads the sha256 recorded in R2 object Metadata", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ Metadata: { sha256: "a".repeat(64) } });

    await expect(
      getSourceSha256({ send }, "bucket", "documents/a/original"),
    ).resolves.toBe("a".repeat(64));
  });

  it("returns undefined when no sha256 is recorded", async () => {
    const send = vi.fn().mockResolvedValue({ Metadata: {} });

    await expect(
      getSourceSha256({ send }, "bucket", "documents/a/original"),
    ).resolves.toBeUndefined();
  });
});

describe("checkB2Copy (18.2/18.3 skip logic)", () => {
  it("reports ok when the B2 object exists with the expected size", async () => {
    const send = vi.fn().mockResolvedValue({ ContentLength: 1024 });

    await expect(
      checkB2Copy({ send }, "bucket", backupKey, 1024),
    ).resolves.toEqual({ status: "ok" });
  });

  it("reports missing when the B2 object does not exist", async () => {
    const send = vi.fn().mockRejectedValue({
      name: "NotFound",
      $metadata: { httpStatusCode: 404 },
    });

    await expect(
      checkB2Copy({ send }, "bucket", backupKey, 1024),
    ).resolves.toEqual({ status: "missing" });
  });

  it("reports a size mismatch when sizes differ", async () => {
    const send = vi.fn().mockResolvedValue({ ContentLength: 512 });

    await expect(
      checkB2Copy({ send }, "bucket", backupKey, 1024),
    ).resolves.toEqual({ status: "size-mismatch", actualSizeBytes: 512 });
  });

  it("propagates unexpected errors instead of treating them as missing", async () => {
    const send = vi.fn().mockRejectedValue(new Error("network error"));

    await expect(
      checkB2Copy({ send }, "bucket", backupKey, 1024),
    ).rejects.toThrow("network error");
  });
});

describe("copyObjectToB2", () => {
  it("streams the R2 body to B2 and preserves the sha256 metadata", async () => {
    const body = new Uint8Array([1, 2, 3]);
    const r2Send = vi.fn().mockResolvedValue({
      Body: { transformToByteArray: async () => body },
      ContentType: "application/octet-stream",
    });
    const b2Send = vi.fn().mockResolvedValue({});

    await copyObjectToB2(
      { send: r2Send },
      "r2-bucket",
      "documents/a/original",
      { send: b2Send },
      "b2-bucket",
      backupKey,
      "a".repeat(64),
    );

    expect(b2Send).toHaveBeenCalledTimes(1);
    const command = b2Send.mock.calls[0][0] as {
      input: { Body: unknown; Metadata?: Record<string, string> };
    };
    expect(command.input.Body).toBe(body);
    expect(command.input.Metadata).toEqual({ sha256: "a".repeat(64) });
  });
});

describe("verifyB2Copy (18.4)", () => {
  it("passes when size and sha256 match", async () => {
    const send = vi.fn().mockResolvedValue({
      ContentLength: 1024,
      Metadata: { sha256: "a".repeat(64) },
    });

    await expect(
      verifyB2Copy({ send }, "bucket", backupKey, 1024, "a".repeat(64)),
    ).resolves.toBeUndefined();
  });

  it("fails the run when the destination is missing", async () => {
    const send = vi.fn().mockResolvedValue(undefined);

    await expect(
      verifyB2Copy({ send }, "bucket", backupKey, 1024),
    ).rejects.toThrow("missing object");
  });

  it("fails the run when size does not match", async () => {
    const send = vi.fn().mockResolvedValue({ ContentLength: 512 });

    await expect(
      verifyB2Copy({ send }, "bucket", backupKey, 1024),
    ).rejects.toThrow("expected 1024 bytes, found 512");
  });

  it("fails the run when sha256 does not match", async () => {
    const send = vi.fn().mockResolvedValue({
      ContentLength: 1024,
      Metadata: { sha256: "b".repeat(64) },
    });

    await expect(
      verifyB2Copy({ send }, "bucket", backupKey, 1024, "a".repeat(64)),
    ).rejects.toThrow("sha256 mismatch");
  });
});
