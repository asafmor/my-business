import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { getDatabase } from "../db/client";
import { auditEvents, documentFiles, documents, reports } from "../db/schema";

export type CreatePdfArtifactInput = {
  documentId: string;
  fileId: string;
  reportId: string;
  month: string; // "YYYY-MM"
  bucket: string;
  objectKey: string;
  sizeBytes: number;
  sha256: string;
  sourceVersion: string;
  generatedAt: Date;
};

export type StoredReportRow = {
  id: string;
  generatedAt: Date;
  sourceVersion: string;
  fileSha256: string;
  objectKey: string;
};

export interface ReportArtifactRepository {
  createPdfArtifact(input: CreatePdfArtifactInput): Promise<void>;
  listForMonth(month: string): Promise<StoredReportRow[]>;
}

// A generated report is an immutable snapshot (SPEC.md #50): this never
// updates or deletes an existing reports/documents/document_files row, only
// inserts a new one, so re-generating a month adds a row rather than
// replacing the last one.
export class DrizzleReportArtifactRepository implements ReportArtifactRepository {
  constructor(private readonly database: typeof getDatabase = getDatabase) {}

  async createPdfArtifact(input: CreatePdfArtifactInput): Promise<void> {
    const pdfMimeType = "application/pdf";

    await this.database().transaction(async (transaction) => {
      await transaction.insert(documents).values({
        id: input.documentId,
        sha256: input.sha256,
        status: "READY",
        type: "GENERATED_REPORT",
      });
      await transaction.insert(documentFiles).values({
        bucket: input.bucket,
        documentId: input.documentId,
        id: input.fileId,
        kind: "GENERATED_REPORT",
        mimeType: pdfMimeType,
        objectKey: input.objectKey,
        sha256: input.sha256,
        sizeBytes: input.sizeBytes,
        storageProvider: "R2",
      });
      await transaction
        .update(documents)
        .set({ originalFileId: input.fileId })
        .where(eq(documents.id, input.documentId));
      await transaction.insert(reports).values({
        documentId: input.documentId,
        fileId: input.fileId,
        fileSha256: input.sha256,
        format: "PDF",
        generatedAt: input.generatedAt,
        id: input.reportId,
        reportingMonth: `${input.month}-01`,
        sourceVersion: input.sourceVersion,
      });
      await transaction.insert(auditEvents).values({
        action: "REPORT_GENERATION",
        entityId: input.reportId,
        entityType: "REPORT",
        newValue: {
          documentId: input.documentId,
          fileId: input.fileId,
          month: input.month,
        },
        source: "USER",
      });
    });
  }

  async listForMonth(month: string): Promise<StoredReportRow[]> {
    return this.database()
      .select({
        fileSha256: reports.fileSha256,
        generatedAt: reports.generatedAt,
        id: reports.id,
        objectKey: documentFiles.objectKey,
        sourceVersion: reports.sourceVersion,
      })
      .from(reports)
      .innerJoin(documentFiles, eq(documentFiles.id, reports.fileId))
      .where(
        sql`${reports.format} = 'PDF' and to_char(${reports.reportingMonth}, 'YYYY-MM') = ${month}`,
      )
      .orderBy(desc(reports.generatedAt));
  }
}
