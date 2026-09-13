import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ObjectStorage } from "../src/server/storage/object-storage";
import { FileValidationError } from "../src/server/storage/file-validation";
import type { DocumentUploadRepository } from "../src/server/documents/upload-repository";
import {
  DocumentUploadPersistenceError,
  DocumentUploadService,
} from "../src/server/documents/upload-service";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const pdf = new TextEncoder().encode("%PDF-1.7");

function createStorage(overrides: Partial<ObjectStorage> = {}): ObjectStorage {
  return {
    createSignedReadUrl: vi.fn(),
    deleteObjectInternally: vi.fn(),
    getObjectMetadata: vi.fn(),
    objectExists: vi.fn(),
    putImmutableObject: vi.fn(async (input) => ({
      bucket: "private-documents",
      contentType: input.contentType,
      key: input.key,
      sha256: input.sha256,
      sizeBytes: input.body.byteLength,
    })),
    ...overrides,
  };
}

function createRepository(
  overrides: Partial<DocumentUploadRepository> = {},
): DocumentUploadRepository {
  return {
    createUpload: vi.fn(),
    findDocumentIdBySha256: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function createService(
  repository = createRepository(),
  storage = createStorage(),
): DocumentUploadService {
  return new DocumentUploadService({ repository, storage });
}

describe("document upload ingestion", () => {
  it.each([
    [jpeg, "receipt.jpg", "image/jpeg"],
    [pdf, "invoice.pdf", "application/pdf"],
  ])(
    "stores a valid %s original and persists its uploaded document",
    async (bytes, fileName, mimeType) => {
      const repository = createRepository();
      const storage = createStorage();

      await expect(
        createService(repository, storage).upload({
          allowDuplicate: false,
          bytes,
          fileName,
          mimeType,
        }),
      ).resolves.toMatchObject({
        mimeType,
        sizeBytes: bytes.byteLength,
        status: "uploaded",
      });

      expect(storage.putImmutableObject).toHaveBeenCalledWith(
        expect.objectContaining({ body: bytes, contentType: mimeType }),
      );
      expect(repository.createUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          audit: expect.objectContaining({
            newValue: expect.objectContaining({ fileName, mimeType }),
          }),
          document: expect.objectContaining({ sha256: expect.any(String) }),
          file: expect.objectContaining({ mimeType }),
        }),
      );
    },
  );

  it("rejects unsupported bytes before querying storage or persistence", async () => {
    const repository = createRepository();
    const storage = createStorage();

    await expect(
      createService(repository, storage).upload({
        allowDuplicate: false,
        bytes: new TextEncoder().encode("not a document"),
        fileName: "notes.txt",
        mimeType: "text/plain",
      }),
    ).rejects.toBeInstanceOf(FileValidationError);
    expect(repository.findDocumentIdBySha256).not.toHaveBeenCalled();
    expect(storage.putImmutableObject).not.toHaveBeenCalled();
  });

  it("warns for an exact hash match until the user explicitly uploads anyway", async () => {
    const repository = createRepository({
      findDocumentIdBySha256: vi
        .fn()
        .mockResolvedValue("de305d54-75b4-431b-adb2-eb6b9e546013"),
    });
    const storage = createStorage();
    const service = createService(repository, storage);

    await expect(
      service.upload({
        allowDuplicate: false,
        bytes: jpeg,
        fileName: "repeat.jpg",
        mimeType: "image/jpeg",
      }),
    ).resolves.toMatchObject({
      existingDocumentId: "de305d54-75b4-431b-adb2-eb6b9e546013",
      status: "duplicate",
    });
    expect(storage.putImmutableObject).not.toHaveBeenCalled();

    await expect(
      service.upload({
        allowDuplicate: true,
        bytes: jpeg,
        fileName: "repeat.jpg",
        mimeType: "image/jpeg",
      }),
    ).resolves.toMatchObject({ status: "uploaded" });
    expect(storage.putImmutableObject).toHaveBeenCalledOnce();
  });

  it("does not persist a success when immutable storage fails", async () => {
    const repository = createRepository();
    const storage = createStorage({
      putImmutableObject: vi
        .fn()
        .mockRejectedValue(new Error("R2 unavailable")),
    });

    await expect(
      createService(repository, storage).upload({
        allowDuplicate: false,
        bytes: jpeg,
        fileName: "receipt.jpg",
        mimeType: "image/jpeg",
      }),
    ).rejects.toThrow("R2 unavailable");
    expect(repository.createUpload).not.toHaveBeenCalled();
  });

  it("removes the stored original when the database transaction fails", async () => {
    const repository = createRepository({
      createUpload: vi
        .fn()
        .mockRejectedValue(new Error("database unavailable")),
    });
    const storage = createStorage();

    await expect(
      createService(repository, storage).upload({
        allowDuplicate: false,
        bytes: jpeg,
        fileName: "receipt.jpg",
        mimeType: "image/jpeg",
      }),
    ).rejects.toBeInstanceOf(DocumentUploadPersistenceError);
    expect(storage.deleteObjectInternally).toHaveBeenCalledOnce();
  });

  it("surfaces recovery details if the compensating object removal also fails", async () => {
    const repository = createRepository({
      createUpload: vi
        .fn()
        .mockRejectedValue(new Error("database unavailable")),
    });
    const storage = createStorage({
      deleteObjectInternally: vi
        .fn()
        .mockRejectedValue(new Error("R2 unavailable")),
    });

    await expect(
      createService(repository, storage).upload({
        allowDuplicate: false,
        bytes: jpeg,
        fileName: "receipt.jpg",
        mimeType: "image/jpeg",
      }),
    ).rejects.toMatchObject({
      recovery: {
        documentId: expect.any(String),
        objectKey: expect.stringMatching(/^documents\//),
      },
    });
  });
});
