import { afterEach, describe, expect, it, vi } from "vitest";

const uploadService = vi.hoisted(() => ({ upload: vi.fn() }));
const dispatcher = vi.hoisted(() => ({
  dispatchDueDocumentProcessing: vi.fn(),
}));
const logger = vi.hoisted(() => ({ logError: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../src/server/documents/upload-service", () => ({
  DocumentUploadService: class {
    upload = uploadService.upload;
  },
}));
vi.mock("../src/server/documents/upload-repository", () => ({
  DrizzleDocumentUploadRepository: class {},
}));
vi.mock("../src/server/storage/object-storage", () => ({
  getR2ObjectStorage: vi.fn(),
}));
vi.mock("../src/server/documents/processing-dispatcher", () => dispatcher);
vi.mock("../src/server/observability/logger", () => logger);

import { uploadDocumentFiles } from "../src/server/documents/upload";
import {
  FileValidationError,
  maximumUploadBytes,
} from "../src/server/storage/file-validation";

afterEach(() => {
  uploadService.upload.mockReset();
  dispatcher.dispatchDueDocumentProcessing.mockReset();
  logger.logError.mockReset();
});

function jpeg(name: string, size = 4): File {
  return new File([new Uint8Array(size)], name, { type: "image/jpeg" });
}

describe("uploadDocumentFiles", () => {
  it("returns one result per file and queues processing once", async () => {
    uploadService.upload
      .mockResolvedValueOnce({
        documentId: "de305d54-75b4-431b-adb2-eb6b9e546013",
        mimeType: "image/jpeg",
        sha256: "a".repeat(64),
        sizeBytes: 4,
        status: "uploaded",
      })
      .mockResolvedValueOnce({
        existingDocumentId: "de305d54-75b4-431b-adb2-eb6b9e546013",
        sha256: "b".repeat(64),
        status: "duplicate",
      });

    const results = await uploadDocumentFiles(
      [jpeg("receipt.jpg"), jpeg("again.jpg")],
      { allowDuplicate: false },
    );

    expect(results).toMatchObject([
      { fileName: "receipt.jpg", status: "uploaded" },
      { fileName: "again.jpg", status: "duplicate" },
    ]);
    expect(dispatcher.dispatchDueDocumentProcessing).toHaveBeenCalledOnce();
  });

  it("drops form entries that are not files", async () => {
    const results = await uploadDocumentFiles(["true", "receipt.jpg"], {
      allowDuplicate: false,
    });

    expect(results).toEqual([]);
    expect(uploadService.upload).not.toHaveBeenCalled();
  });

  it("rejects an oversized file before reading its bytes", async () => {
    const results = await uploadDocumentFiles(
      [jpeg("huge.jpg", maximumUploadBytes + 1)],
      { allowDuplicate: false },
    );

    expect(results).toEqual([
      {
        fileName: "huge.jpg",
        message: "File exceeds the maximum upload size.",
        status: "rejected",
      },
    ]);
    expect(uploadService.upload).not.toHaveBeenCalled();
    expect(dispatcher.dispatchDueDocumentProcessing).not.toHaveBeenCalled();
  });

  it("keeps a rejected file from becoming a success and reports failures", async () => {
    uploadService.upload
      .mockRejectedValueOnce(new FileValidationError("Unsupported file."))
      .mockRejectedValueOnce(new Error("storage is down"));

    const results = await uploadDocumentFiles(
      [jpeg("notes.txt"), jpeg("receipt.jpg")],
      { allowDuplicate: false },
    );

    expect(results).toEqual([
      {
        fileName: "notes.txt",
        message: "Unsupported file.",
        status: "rejected",
      },
      {
        fileName: "receipt.jpg",
        message: "The file could not be uploaded. Please try again.",
        status: "failed",
      },
    ]);
    expect(logger.logError).toHaveBeenCalledOnce();
    expect(dispatcher.dispatchDueDocumentProcessing).not.toHaveBeenCalled();
  });
});
