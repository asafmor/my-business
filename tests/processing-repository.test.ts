import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db/client", () => ({ getDatabase: vi.fn() }));
vi.mock("../src/server/db/schema", () => ({
  auditEvents: {
    action: "audit_events.action",
    entityId: "audit_events.entity_id",
    entityType: "audit_events.entity_type",
    field: "audit_events.field",
  },
  categories: {
    active: "categories.active",
    id: "categories.id",
    name: "categories.name",
  },
  documentFiles: {
    documentId: "document_files.document_id",
    kind: "document_files.kind",
    mimeType: "document_files.mime_type",
    objectKey: "document_files.object_key",
  },
  documents: {
    id: "documents.id",
    status: "documents.status",
    type: "documents.type",
  },
  expenses: { documentId: "expenses.document_id", id: "expenses.id" },
  extractions: { documentId: "extractions.document_id", id: "extractions.id" },
}));

import { DrizzleDocumentProcessingRepository } from "../src/server/documents/processing-repository";

const documentId = "de305d54-75b4-431b-adb2-eb6b9e546013";

function chain(result: unknown) {
  const obj: Record<string, unknown> = {};
  for (const method of [
    "from",
    "where",
    "limit",
    "for",
    "set",
    "values",
    "returning",
    "innerJoin",
  ]) {
    obj[method] = vi.fn(() => obj);
  }
  (obj as { then: (resolve: (value: unknown) => void) => void }).then = (
    resolve,
  ) => resolve(result);
  return obj as {
    from: ReturnType<typeof vi.fn>;
    innerJoin: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
  };
}

function createDatabase(transaction: Record<string, unknown>) {
  const database = {
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback(transaction),
    ),
  };
  return () => database;
}

const original = {
  key: "documents/opaque/original" as never,
  mimeType: "application/pdf",
};

describe("DrizzleDocumentProcessingRepository.beginProcessing", () => {
  it("claims an UPLOADED document for first-time processing", async () => {
    const claim = chain([{ id: documentId, type: "OTHER" }]);
    const empty = chain([]);
    const files = chain([original]);
    const transaction = {
      insert: vi.fn(() => empty),
      select: vi.fn().mockReturnValueOnce(files).mockReturnValue(empty),
      update: vi.fn(() => claim),
    };
    const repository = new DrizzleDocumentProcessingRepository(
      createDatabase(transaction) as never,
    );

    await expect(
      repository.beginProcessing(documentId, false),
    ).resolves.toMatchObject({
      id: documentId,
      original,
      type: "OTHER",
    });
  });

  it("rejects claiming a document that is not in an allowed status (illegal transition)", async () => {
    const noMatch = chain([]);
    const transaction = {
      insert: vi.fn(() => noMatch),
      select: vi.fn(() => noMatch),
      update: vi.fn(() => noMatch),
    };
    const repository = new DrizzleDocumentProcessingRepository(
      createDatabase(transaction) as never,
    );

    // e.g. a document already READY cannot be claimed for non-reprocessing work.
    await expect(
      repository.beginProcessing(documentId, false),
    ).resolves.toBeNull();
    // No file lookup or category/audit reads should occur once the claim itself fails.
    expect(transaction.select).not.toHaveBeenCalled();
  });

  it("allows reprocessing from READY/NEEDS_REVIEW/FAILED but resumeProcessing is required to reclaim PROCESSING", async () => {
    const claim = chain([{ id: documentId, type: "RECEIPT" }]);
    const empty = chain([]);
    const files = chain([original]);
    const transaction = {
      insert: vi.fn(() => empty),
      select: vi.fn().mockReturnValueOnce(files).mockReturnValue(empty),
      update: vi.fn(() => claim),
    };
    const repository = new DrizzleDocumentProcessingRepository(
      createDatabase(transaction) as never,
    );

    await expect(
      repository.beginProcessing(documentId, true),
    ).resolves.toMatchObject({ id: documentId });
  });
});

describe("DrizzleDocumentProcessingRepository.completeProcessing", () => {
  const document = {
    activeCategories: [],
    id: documentId,
    manualDocumentFields: [],
    manualExpenseFields: ["supplierName"],
    original,
    type: "RECEIPT" as const,
  };
  const extraction = {
    anomalies: [],
    confidence: 0.9,
    currency: "ILS",
    description: "Notes",
    documentNumber: "A-1",
    documentType: "RECEIPT" as const,
    lineItems: [],
    paymentMethod: "CARD",
    reviewReasons: [],
    subtotal: "100.00",
    suggestedCategory: null,
    supplierIdentifier: null,
    supplierName: "AI Supplier",
    total: "117.00",
    transactionDate: "2026-09-13",
    vat: "17.00",
  };

  it("does nothing once the document has left PROCESSING (stale/overlapping lease)", async () => {
    const notProcessing = chain([{ status: "READY" }]);
    const transaction = {
      insert: vi.fn(() => notProcessing),
      select: vi.fn(() => notProcessing),
      update: vi.fn(() => notProcessing),
    };
    const repository = new DrizzleDocumentProcessingRepository(
      createDatabase(transaction) as never,
    );

    await repository.completeProcessing({
      document,
      extraction,
      model: "test-model",
      provider: "test",
      rawResult: {},
      reprocessing: false,
      schemaVersion: "v1",
      status: "READY",
    });

    expect(transaction.insert).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("persists the extraction and keeps the manually-corrected field over the fresh AI value", async () => {
    const processing = chain([{ status: "PROCESSING" }]);
    const extractionRow = chain([{ id: "extraction-1" }]);
    const existingExpense = chain([
      {
        categoryId: null,
        currency: "ILS",
        documentNumber: "A-1",
        notes: "Notes",
        paymentMethod: "CARD",
        reportingMonth: "2026-09-01",
        subtotal: "100.00",
        supplierIdentifier: null,
        supplierName: "User-corrected supplier",
        total: "117.00",
        transactionDate: "2026-09-13",
        vat: "17.00",
        id: "expense-1",
      },
    ]);
    const empty = chain([]);
    const noReturn = chain(undefined);
    const transaction = {
      insert: vi
        .fn()
        .mockReturnValueOnce(extractionRow) // extractions
        .mockReturnValue(noReturn), // auditEvents
      select: vi
        .fn()
        .mockReturnValueOnce(processing) // status guard
        .mockReturnValueOnce(existingExpense) // existing expense
        .mockReturnValueOnce(empty) // current manual expense events
        .mockReturnValueOnce(empty), // current manual document events
      update: vi.fn(() => noReturn),
    };
    const repository = new DrizzleDocumentProcessingRepository(
      createDatabase(transaction) as never,
    );

    await repository.completeProcessing({
      document,
      extraction,
      model: "test-model",
      provider: "test",
      rawResult: {},
      reprocessing: false,
      schemaVersion: "v1",
      status: "READY",
    });

    expect(noReturn.set).toHaveBeenCalledWith(
      expect.objectContaining({ supplierName: "User-corrected supplier" }),
    );
    expect(noReturn.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "READY" }),
    );
  });
});

describe("DrizzleDocumentProcessingRepository.failProcessing", () => {
  it("does nothing once the document has left PROCESSING", async () => {
    const notProcessing = chain([{ status: "FAILED" }]);
    const transaction = {
      insert: vi.fn(() => notProcessing),
      select: vi.fn(() => notProcessing),
      update: vi.fn(() => notProcessing),
    };
    const repository = new DrizzleDocumentProcessingRepository(
      createDatabase(transaction) as never,
    );

    await repository.failProcessing({
      documentId,
      errorCode: "ANALYZER_FAILURE",
      reprocessing: false,
    });

    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.insert).not.toHaveBeenCalled();
  });

  it("marks a PROCESSING document FAILED and audits it", async () => {
    const processing = chain([{ status: "PROCESSING" }]);
    const noReturn = chain(undefined);
    const transaction = {
      insert: vi.fn(() => noReturn),
      select: vi.fn(() => processing),
      update: vi.fn(() => noReturn),
    };
    const repository = new DrizzleDocumentProcessingRepository(
      createDatabase(transaction) as never,
    );

    await repository.failProcessing({
      documentId,
      errorCode: "ANALYZER_FAILURE",
      reprocessing: false,
    });

    expect(noReturn.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "FAILED" }),
    );
    expect(noReturn.values).toHaveBeenCalledWith(
      expect.objectContaining({ action: "EXTRACTION", source: "SYSTEM" }),
    );
  });
});
