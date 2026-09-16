import "server-only";

import { and, eq, ne } from "drizzle-orm";

import { getDatabase } from "../db/client";
import {
  auditEvents,
  documentFiles,
  documents,
  processingTasks,
} from "../db/schema";

export type UploadRecord = {
  audit: {
    entityId: string;
    newValue: Record<string, string | number>;
  };
  document: {
    id: string;
    sha256: string;
  };
  file: {
    bucket: string;
    id: string;
    mimeType: string;
    objectKey: string;
    sha256: string;
    sizeBytes: number;
  };
};

export interface DocumentUploadRepository {
  findDocumentIdBySha256(sha256: string): Promise<string | null>;
  createUpload(record: UploadRecord): Promise<void>;
}

export class DrizzleDocumentUploadRepository implements DocumentUploadRepository {
  constructor(private readonly database: typeof getDatabase = getDatabase) {}

  async findDocumentIdBySha256(sha256: string): Promise<string | null> {
    const [document] = await this.database()
      .select({ id: documents.id })
      .from(documents)
      // Archived is this app's delete (SPEC.md #49), so an archived document
      // must not warn the user about a duplicate — same rule as isDuplicateExpr.
      .where(
        and(eq(documents.sha256, sha256), ne(documents.status, "ARCHIVED")),
      )
      .limit(1);

    return document?.id ?? null;
  }

  async createUpload(record: UploadRecord): Promise<void> {
    await this.database().transaction(async (transaction) => {
      await transaction.insert(documents).values({
        id: record.document.id,
        sha256: record.document.sha256,
        status: "UPLOADED",
        type: "OTHER",
      });
      await transaction.insert(documentFiles).values({
        bucket: record.file.bucket,
        documentId: record.document.id,
        id: record.file.id,
        kind: "ORIGINAL",
        mimeType: record.file.mimeType,
        objectKey: record.file.objectKey,
        sha256: record.file.sha256,
        sizeBytes: record.file.sizeBytes,
        storageProvider: "R2",
      });
      await transaction
        .update(documents)
        .set({ originalFileId: record.file.id })
        .where(eq(documents.id, record.document.id));
      await transaction.insert(auditEvents).values({
        action: "UPLOAD",
        entityId: record.audit.entityId,
        entityType: "DOCUMENT",
        newValue: record.audit.newValue,
        source: "USER",
      });
      await transaction.insert(processingTasks).values({
        documentId: record.document.id,
      });
    });
  }
}
