import { describe, expect, it } from "vitest";

import type {
  AuditEvent,
  Document,
  DocumentFile,
  Extraction,
} from "../src/domain/documents/types";
import type { Expense } from "../src/domain/expenses/types";
import {
  auditEventInputSchema,
  documentFileInputSchema,
  documentInputSchema,
  expenseInputSchema,
  extractionInputSchema,
  reportInputSchema,
} from "../src/domain/validation";

const documentId = "de305d54-75b4-431b-adb2-eb6b9e546013";
const fileId = "c56a4180-65aa-42ec-a945-5fd21dec0538";
const sha256 = "a".repeat(64);
const createdAt = new Date("2026-09-13T12:00:00.000Z");

const persistedDocument = {
  id: documentId,
  type: "RECEIPT",
  status: "READY",
  originalFileId: fileId,
  sha256,
  transactionDate: "2026-09-13",
  reviewedAt: createdAt,
  createdAt,
  updatedAt: createdAt,
} satisfies Document;

const persistedDocumentFile = {
  id: fileId,
  documentId,
  kind: "ORIGINAL",
  storageProvider: "R2",
  bucket: "rotem",
  objectKey: "documents/opaque-id/original",
  mimeType: "application/pdf",
  sizeBytes: 1_024,
  sha256,
  createdAt,
} satisfies DocumentFile;

const persistedExpense = {
  id: "880e8400-e29b-41d4-a716-446655440000",
  documentId,
  supplierName: "Office Depot",
  supplierIdentifier: "IL-123456789",
  documentNumber: "INV-42",
  transactionDate: "2026-09-13",
  currency: "ILS",
  subtotal: "100.00",
  vat: "17.00",
  total: "117.00",
  categoryId: null,
  businessUsePercentage: "75.5",
  deductibleVatPercentage: "100",
  notes: null,
  paymentMethod: "CARD",
  reportingMonth: "2026-09-01",
  createdAt,
  updatedAt: createdAt,
} satisfies Expense;

const persistedExtraction = {
  id: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
  documentId,
  provider: "openai",
  model: "gpt-5",
  schemaVersion: "v1",
  rawResult: { response: { total: "117.00" } },
  normalizedResult: { total: "117.00" },
  createdAt,
} satisfies Extraction;

const persistedAuditEvent = {
  id: "16fd2706-8baf-433b-82eb-8c7fada847da",
  entityType: "EXPENSE",
  entityId: persistedExpense.id,
  action: "MANUAL_EDIT",
  field: "total",
  oldValue: "117.00",
  newValue: "118.00",
  source: "USER",
  createdAt,
} satisfies AuditEvent;

describe("domain validation", () => {
  it("accepts documented document values and valid ISO dates", () => {
    const document = documentInputSchema.parse({
      type: "RECEIPT",
      sha256,
      transactionDate: "2026-09-13",
    });

    expect(document.status).toBe("UPLOADED");
    expect(document.transactionDate).toBe("2026-09-13");
  });

  it("rejects unsupported document enums and invalid calendar dates", () => {
    expect(
      documentInputSchema.safeParse({
        type: "UNKNOWN",
        sha256,
        transactionDate: "2026-02-30",
      }).success,
    ).toBe(false);
  });

  it("requires valid document-file relationships and immutable file metadata", () => {
    expect(
      documentFileInputSchema.safeParse({
        documentId: "not-a-uuid",
        kind: "ORIGINAL",
        storageProvider: "R2",
        bucket: "rotem",
        objectKey: "documents/opaque-id/original",
        mimeType: "application/pdf",
        sizeBytes: -1,
        sha256,
      }).success,
    ).toBe(false);
  });

  it("preserves exact money strings and bounds percentages", () => {
    expect(expenseInputSchema.parse(persistedExpense)).toMatchObject({
      total: "117.00",
      businessUsePercentage: "75.5",
    });

    expect(
      expenseInputSchema.safeParse({
        documentId,
        total: "117.001",
        businessUsePercentage: "100.01",
      }).success,
    ).toBe(false);
  });

  it("keeps persisted document contracts aligned with their input boundaries", () => {
    expect(documentInputSchema.parse(persistedDocument)).toMatchObject({
      type: persistedDocument.type,
      status: persistedDocument.status,
      originalFileId: persistedDocument.originalFileId,
    });
    expect(documentFileInputSchema.parse(persistedDocumentFile)).toMatchObject({
      documentId: persistedDocumentFile.documentId,
      kind: persistedDocumentFile.kind,
      storageProvider: persistedDocumentFile.storageProvider,
      sha256: persistedDocumentFile.sha256,
    });
  });

  it("keeps extraction and audit persistence contracts JSON-safe", () => {
    expect(extractionInputSchema.parse(persistedExtraction)).toMatchObject({
      documentId: persistedExtraction.documentId,
      rawResult: persistedExtraction.rawResult,
      normalizedResult: persistedExtraction.normalizedResult,
    });
    expect(auditEventInputSchema.parse(persistedAuditEvent)).toMatchObject({
      entityType: persistedAuditEvent.entityType,
      entityId: persistedAuditEvent.entityId,
      action: persistedAuditEvent.action,
      oldValue: persistedAuditEvent.oldValue,
      newValue: persistedAuditEvent.newValue,
      source: persistedAuditEvent.source,
    });
    expect(
      auditEventInputSchema.safeParse({
        ...persistedAuditEvent,
        oldValue: () => "not JSON",
      }).success,
    ).toBe(false);
  });

  it("requires report records to reference a document and generated file", () => {
    expect(
      reportInputSchema.safeParse({
        documentId,
        fileId,
        reportingMonth: "2026-09-01",
        format: "PDF",
        sourceVersion: "monthly-v1",
        fileSha256: sha256,
      }).success,
    ).toBe(true);

    expect(
      reportInputSchema.safeParse({
        documentId,
        fileId: "wrong",
        reportingMonth: "2026-13-01",
        format: "DOCX",
        sourceVersion: "monthly-v1",
        fileSha256: sha256,
      }).success,
    ).toBe(false);
  });
});
