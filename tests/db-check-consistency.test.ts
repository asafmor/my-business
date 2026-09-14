import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/schema", () => ({
  documentFiles: { documentId: "x", objectKey: "x", sha256: "x" },
}));
vi.mock("@/server/config/cloud-environment", () => ({
  assertDatabaseEnvironment: vi.fn(),
  assertR2Environment: vi.fn(),
}));

import {
  checkDocumentFilesAgainstB2,
  checkDocumentFilesAgainstR2,
  findOrphanedR2Objects,
} from "../scripts/db/check-consistency";

const documentId = "de305d54-75b4-431b-adb2-eb6b9e546013";
const objectKey = `documents/${documentId}/original`;

describe("checkDocumentFilesAgainstR2", () => {
  it("reports ok when the object exists with a matching sha256", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ Metadata: { sha256: "a".repeat(64) } });

    await expect(
      checkDocumentFilesAgainstR2({ send }, "bucket", [
        { documentId, objectKey, sha256: "a".repeat(64) },
      ]),
    ).resolves.toEqual([{ objectKey, status: "ok" }]);
  });

  it("reports missing when the R2 object does not exist", async () => {
    const send = vi.fn().mockRejectedValue({
      name: "NotFound",
      $metadata: { httpStatusCode: 404 },
    });

    await expect(
      checkDocumentFilesAgainstR2({ send }, "bucket", [
        { documentId, objectKey, sha256: "a".repeat(64) },
      ]),
    ).resolves.toEqual([{ objectKey, status: "missing" }]);
  });

  it("reports a sha256 mismatch", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ Metadata: { sha256: "b".repeat(64) } });

    await expect(
      checkDocumentFilesAgainstR2({ send }, "bucket", [
        { documentId, objectKey, sha256: "a".repeat(64) },
      ]),
    ).resolves.toEqual([
      { objectKey, status: "sha256-mismatch", foundSha256: "b".repeat(64) },
    ]);
  });

  it("propagates unexpected errors instead of treating them as missing", async () => {
    const send = vi.fn().mockRejectedValue(new Error("network error"));

    await expect(
      checkDocumentFilesAgainstR2({ send }, "bucket", [
        { documentId, objectKey, sha256: "a".repeat(64) },
      ]),
    ).rejects.toThrow("network error");
  });
});

describe("checkDocumentFilesAgainstB2", () => {
  it("reports ok when a backup copy exists", async () => {
    const send = vi.fn().mockResolvedValue({ Metadata: {} });

    await expect(
      checkDocumentFilesAgainstB2({ send }, "bucket", [
        { documentId, objectKey, sha256: "a".repeat(64) },
      ]),
    ).resolves.toEqual([{ objectKey, status: "ok" }]);
  });

  it("reports missing when no backup copy exists", async () => {
    const send = vi.fn().mockRejectedValue({
      name: "NotFound",
      $metadata: { httpStatusCode: 404 },
    });

    await expect(
      checkDocumentFilesAgainstB2({ send }, "bucket", [
        { documentId, objectKey, sha256: "a".repeat(64) },
      ]),
    ).resolves.toEqual([{ objectKey, status: "missing" }]);
  });
});

describe("findOrphanedR2Objects", () => {
  it("lists R2 objects with no matching document_files row", async () => {
    const send = vi.fn().mockResolvedValue({
      Contents: [{ Key: objectKey }, { Key: "health/cloud-foundation.txt" }],
      IsTruncated: false,
    });

    await expect(
      findOrphanedR2Objects({ send }, "bucket", new Set([objectKey])),
    ).resolves.toEqual(["health/cloud-foundation.txt"]);
  });

  it("paginates with continuation tokens", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Contents: [{ Key: "a" }],
        IsTruncated: true,
        NextContinuationToken: "token-1",
      })
      .mockResolvedValueOnce({ Contents: [{ Key: "b" }], IsTruncated: false });

    await expect(
      findOrphanedR2Objects({ send }, "bucket", new Set()),
    ).resolves.toEqual(["a", "b"]);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
