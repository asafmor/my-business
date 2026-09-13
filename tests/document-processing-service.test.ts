import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  documentExtractionSchemaVersion,
  DocumentAnalyzerError,
} from "../src/server/ai/document-analyzer";
import type {
  AnalyzedDocumentExtraction,
  DocumentAnalyzer,
} from "../src/server/ai/document-analyzer";
import { preserveManualExpenseValues } from "../src/server/documents/processing-authority";
import type { DocumentProcessingRepository } from "../src/server/documents/processing-repository";
import { DocumentProcessingService } from "../src/server/documents/processing-service";
import type { ObjectStorage } from "../src/server/storage/object-storage";

const documentId = "de305d54-75b4-431b-adb2-eb6b9e546013";

const validExtraction: AnalyzedDocumentExtraction = {
  anomalies: [],
  confidence: 0.97,
  currency: "ILS",
  description: "Office stationery",
  documentNumber: "A-42",
  documentType: "RECEIPT",
  lineItems: [
    {
      description: "Paper",
      quantity: "1",
      total: "117.00",
      unitPrice: "100.00",
      vat: "17.00",
    },
  ],
  paymentMethod: "CARD",
  subtotal: "100.00",
  suggestedCategory: "Office supplies",
  supplierIdentifier: "IL-123",
  supplierName: "Office Depot",
  total: "117.00",
  transactionDate: "2026-09-13",
  vat: "17.00",
};

function createRepository(
  overrides: Partial<DocumentProcessingRepository> = {},
): DocumentProcessingRepository {
  return {
    beginProcessing: vi.fn().mockResolvedValue({
      activeCategories: [
        { id: "880e8400-e29b-41d4-a716-446655440000", name: "Office supplies" },
      ],
      id: documentId,
      manualDocumentFields: [],
      manualExpenseFields: [],
      original: {
        key: "documents/opaque/original",
        mimeType: "application/pdf",
      },
      type: "OTHER",
    }),
    completeProcessing: vi.fn(),
    failProcessing: vi.fn(),
    ...overrides,
  };
}

function createStorage(): ObjectStorage {
  return {
    getStoredDocumentContent: vi.fn().mockResolvedValue({
      body: new Uint8Array([1, 2, 3]),
      contentType: "application/pdf",
    }),
  } as unknown as ObjectStorage;
}

function createAnalyzer(
  extraction: AnalyzedDocumentExtraction = validExtraction,
): DocumentAnalyzer {
  return {
    analyze: vi.fn().mockResolvedValue({
      extraction,
      model: "test-model",
      provider: "test",
      rawResult: { responseId: "test-response" },
      schemaVersion: documentExtractionSchemaVersion,
    }),
  };
}

function createService(
  repository = createRepository(),
  analyzer = createAnalyzer(),
): DocumentProcessingService {
  return new DocumentProcessingService({
    analyzer,
    repository,
    storage: createStorage(),
  });
}

describe("document processing", () => {
  it("persists a validated successful extraction as READY", async () => {
    const repository = createRepository();

    await expect(
      createService(repository).process(documentId),
    ).resolves.toEqual({
      status: "ready",
    });
    expect(repository.beginProcessing).toHaveBeenCalledWith(documentId, false);
    expect(repository.completeProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        rawResult: { responseId: "test-response" },
        schemaVersion: documentExtractionSchemaVersion,
        status: "READY",
      }),
    );
  });

  it("does not analyze or persist a duplicate processing claim", async () => {
    const claimedDocument = {
      activeCategories: [
        { id: "880e8400-e29b-41d4-a716-446655440000", name: "Office supplies" },
      ],
      id: documentId,
      manualDocumentFields: [],
      manualExpenseFields: [],
      original: {
        key: "documents/opaque/original" as const,
        mimeType: "application/pdf" as const,
      },
      type: "OTHER" as const,
    };
    const repository = createRepository({
      beginProcessing: vi
        .fn()
        .mockResolvedValueOnce(claimedDocument)
        .mockResolvedValueOnce(null),
    });
    const analyzer = createAnalyzer();

    await expect(
      Promise.all([
        createService(repository, analyzer).process(documentId),
        createService(repository, analyzer).process(documentId),
      ]),
    ).resolves.toEqual(
      expect.arrayContaining([
        { status: "already-processing" },
        { status: "ready" },
      ]),
    );

    expect(analyzer.analyze).toHaveBeenCalledOnce();
    expect(repository.completeProcessing).toHaveBeenCalledOnce();
  });

  it("marks missing required extraction fields for review instead of inventing them", async () => {
    const repository = createRepository();
    const extraction = { ...validExtraction, total: null };

    await expect(
      createService(repository, createAnalyzer(extraction)).process(documentId),
    ).resolves.toEqual(
      expect.objectContaining({
        reviewReasons: expect.arrayContaining(["MISSING_TOTAL"]),
        status: "needs-review",
      }),
    );
    expect(repository.completeProcessing).toHaveBeenCalledWith(
      expect.objectContaining({ status: "NEEDS_REVIEW" }),
    );
  });

  it("marks inconsistent VAT totals for review", async () => {
    const repository = createRepository();
    const extraction = { ...validExtraction, total: "116.00" };

    await expect(
      createService(repository, createAnalyzer(extraction)).process(documentId),
    ).resolves.toEqual(
      expect.objectContaining({
        reviewReasons: expect.arrayContaining(["TOTALS_DO_NOT_RECONCILE"]),
        status: "needs-review",
      }),
    );
  });

  it("marks low-confidence extraction for review", async () => {
    const repository = createRepository();
    const extraction = { ...validExtraction, confidence: 0.4 };

    await expect(
      createService(repository, createAnalyzer(extraction)).process(documentId),
    ).resolves.toEqual(
      expect.objectContaining({
        reviewReasons: expect.arrayContaining(["LOW_CONFIDENCE"]),
        status: "needs-review",
      }),
    );
  });

  it("records a provider failure as FAILED without retrying in the request", async () => {
    const repository = createRepository();
    const analyzer: DocumentAnalyzer = {
      analyze: vi.fn().mockRejectedValue(new Error("provider unavailable")),
    };

    await expect(
      createService(repository, analyzer).process(documentId),
    ).rejects.toThrow("provider unavailable");
    expect(repository.failProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "ANALYZER_FAILURE",
        reprocessing: false,
      }),
    );
  });

  it("retains an invalid provider response for failure diagnostics without exposing it", async () => {
    const repository = createRepository();
    const rawResult = { output_text: "not-json" };
    const analyzer: DocumentAnalyzer = {
      analyze: vi.fn().mockRejectedValue(
        new DocumentAnalyzerError("invalid JSON", {
          model: "test-model",
          provider: "test",
          rawResult,
          schemaVersion: documentExtractionSchemaVersion,
        }),
      ),
    };

    await expect(
      createService(repository, analyzer).process(documentId),
    ).rejects.toThrow("invalid JSON");
    expect(repository.failProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "INVALID_AI_RESPONSE",
        rawResult,
      }),
    );
  });

  it("explicitly reprocesses without changing the manual-authority metadata", async () => {
    const repository = createRepository({
      beginProcessing: vi.fn().mockResolvedValue({
        activeCategories: [
          {
            id: "880e8400-e29b-41d4-a716-446655440000",
            name: "Office supplies",
          },
        ],
        id: documentId,
        manualDocumentFields: ["type"],
        manualExpenseFields: ["supplierName", "total"],
        original: {
          key: "documents/opaque/original",
          mimeType: "application/pdf",
        },
        type: "RECEIPT",
      }),
    });

    await expect(
      createService(repository).reprocess(documentId),
    ).resolves.toEqual({
      status: "ready",
    });
    expect(repository.beginProcessing).toHaveBeenCalledWith(documentId, true);
    expect(repository.completeProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        document: expect.objectContaining({
          manualExpenseFields: ["supplierName", "total"],
        }),
        reprocessing: true,
      }),
    );

    const extracted = {
      categoryId: null,
      currency: "ILS",
      documentNumber: "AI-42",
      notes: "AI description",
      paymentMethod: "CARD",
      reportingMonth: "2026-09-01",
      subtotal: "100.00",
      supplierIdentifier: "AI-ID",
      supplierName: "AI supplier",
      total: "117.00",
      transactionDate: "2026-09-13",
      vat: "17.00",
    };
    const existing = {
      ...extracted,
      supplierName: "User-corrected supplier",
      total: "118.00",
    };
    expect(
      preserveManualExpenseValues(
        existing,
        extracted,
        new Set(["supplierName", "total"]),
      ),
    ).toMatchObject({
      supplierName: "User-corrected supplier",
      total: "118.00",
      vat: "17.00",
    });
  });
});
