import "server-only";

import { randomUUID } from "node:crypto";

import {
  auditEventInputSchema,
  documentFileInputSchema,
  documentInputSchema,
} from "../../domain/validation";
import { validateUploadFile } from "../storage/file-validation";
import { documentOriginalObjectKey } from "../storage/object-keys";
import type { ObjectStorage } from "../storage/object-storage";
import { calculateSha256 } from "../storage/sha256";

import type {
  DocumentUploadRepository,
  UploadRecord,
} from "./upload-repository";

export type DocumentUploadInput = {
  allowDuplicate: boolean;
  bytes: Uint8Array;
  fileName: string;
  mimeType?: string;
};

export type DocumentUploadResult =
  | {
      documentId: string;
      mimeType: string;
      sha256: string;
      sizeBytes: number;
      status: "uploaded";
    }
  | {
      existingDocumentId: string;
      sha256: string;
      status: "duplicate";
    };

export class DocumentUploadPersistenceError extends Error {
  constructor(
    message: string,
    public readonly recovery: { documentId: string; objectKey: string },
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class DocumentUploadService {
  constructor(
    private readonly dependencies: {
      repository: DocumentUploadRepository;
      storage: ObjectStorage;
    },
  ) {}

  async upload(input: DocumentUploadInput): Promise<DocumentUploadResult> {
    const validated = validateUploadFile({
      bytes: input.bytes,
      mimeType: input.mimeType,
    });
    const sha256 = calculateSha256(input.bytes);
    const existingDocumentId =
      await this.dependencies.repository.findDocumentIdBySha256(sha256);

    if (existingDocumentId && !input.allowDuplicate) {
      return { existingDocumentId, sha256, status: "duplicate" };
    }

    const documentId = randomUUID();
    const fileId = randomUUID();
    const objectKey = documentOriginalObjectKey(documentId);
    const stored = await this.dependencies.storage.putImmutableObject({
      body: input.bytes,
      contentType: validated.mimeType,
      key: objectKey,
      sha256,
    });
    const record = this.createRecord({
      documentId,
      fileId,
      fileName: input.fileName,
      mimeType: validated.mimeType,
      objectKey: stored.key,
      sha256,
      sizeBytes: validated.sizeBytes,
      bucket: stored.bucket,
    });

    try {
      await this.dependencies.repository.createUpload(record);
    } catch (error) {
      try {
        await this.dependencies.storage.deleteObjectInternally(objectKey);
      } catch (cleanupError) {
        throw new DocumentUploadPersistenceError(
          "Document record failed and the uploaded object needs recovery.",
          { documentId, objectKey },
          { cause: cleanupError },
        );
      }

      throw new DocumentUploadPersistenceError(
        "Document record failed; the uploaded object was removed.",
        { documentId, objectKey },
        { cause: error },
      );
    }

    return {
      documentId,
      mimeType: validated.mimeType,
      sha256,
      sizeBytes: validated.sizeBytes,
      status: "uploaded",
    };
  }

  private createRecord(input: {
    bucket: string;
    documentId: string;
    fileId: string;
    fileName: string;
    mimeType: string;
    objectKey: string;
    sha256: string;
    sizeBytes: number;
  }): UploadRecord {
    const document = documentInputSchema.parse({
      id: input.documentId,
      sha256: input.sha256,
      status: "UPLOADED",
      type: "OTHER",
    });
    const file = documentFileInputSchema.parse({
      bucket: input.bucket,
      documentId: input.documentId,
      id: input.fileId,
      kind: "ORIGINAL",
      mimeType: input.mimeType,
      objectKey: input.objectKey,
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      storageProvider: "R2",
    });
    const audit = auditEventInputSchema.parse({
      action: "UPLOAD",
      entityId: input.documentId,
      entityType: "DOCUMENT",
      newValue: {
        fileName: input.fileName,
        mimeType: input.mimeType,
        sha256: input.sha256,
        sizeBytes: input.sizeBytes,
      },
      source: "USER",
    });

    return {
      audit: {
        entityId: audit.entityId,
        newValue: (audit.newValue ?? {}) as Record<string, string | number>,
      },
      document: {
        id: document.id ?? input.documentId,
        sha256: document.sha256,
      },
      file: {
        bucket: file.bucket,
        id: file.id ?? input.fileId,
        mimeType: file.mimeType,
        objectKey: file.objectKey,
        sha256: file.sha256,
        sizeBytes: file.sizeBytes,
      },
    };
  }
}
