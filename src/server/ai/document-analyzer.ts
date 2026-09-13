import "server-only";

import { z } from "zod";

import { documentTypes } from "../../domain/documents/types";
import type { DocumentType, JsonObject } from "../../domain/documents/types";

export const documentExtractionSchemaVersion = "2026-09-13.1";
export const automaticExtractionConfidenceThreshold = 0.85;

const extractedTextSchema = z.string().trim().min(1).max(10_000).nullable();
const extractedMoneySchema = z.string().trim().min(1).max(32).nullable();
const exactMoney = /^(?:0|[1-9]\d*)\.\d{2}$/;
const exactQuantity = /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/;

export const analyzedDocumentExtractionSchema = z
  .object({
    anomalies: z.array(z.string().trim().min(1).max(500)).max(50),
    confidence: z.number().finite(),
    currency: z.string().trim().max(10).nullable(),
    description: extractedTextSchema,
    documentNumber: extractedTextSchema,
    documentType: z.string().trim().max(100).nullable(),
    lineItems: z
      .array(
        z
          .object({
            description: extractedTextSchema,
            quantity: z.string().trim().min(1).max(32).nullable(),
            total: extractedMoneySchema,
            unitPrice: extractedMoneySchema,
            vat: extractedMoneySchema,
          })
          .strict(),
      )
      .max(200),
    paymentMethod: extractedTextSchema,
    subtotal: extractedMoneySchema,
    suggestedCategory: extractedTextSchema,
    supplierIdentifier: extractedTextSchema,
    supplierName: extractedTextSchema,
    total: extractedMoneySchema,
    transactionDate: z.string().trim().max(32).nullable(),
    vat: extractedMoneySchema,
  })
  .strict();

export type AnalyzedDocumentExtraction = z.infer<
  typeof analyzedDocumentExtractionSchema
>;

export type DocumentAnalyzerInput = {
  categoryNames: readonly string[];
  content: Uint8Array;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
};

export type DocumentAnalyzerOutput = {
  extraction: AnalyzedDocumentExtraction;
  model: string;
  provider: string;
  rawResult: JsonObject;
  schemaVersion: typeof documentExtractionSchemaVersion;
};

export interface DocumentAnalyzer {
  analyze(input: DocumentAnalyzerInput): Promise<DocumentAnalyzerOutput>;
}

export class DocumentAnalyzerError extends Error {
  readonly details?: {
    model?: string;
    provider?: string;
    rawResult?: JsonObject;
    schemaVersion?: typeof documentExtractionSchemaVersion;
  };

  constructor(
    message: string,
    details?: {
      model?: string;
      provider?: string;
      rawResult?: JsonObject;
      schemaVersion?: typeof documentExtractionSchemaVersion;
    },
    options?: ErrorOptions,
  ) {
    super(message, options);
    // Raw AI output can be persisted by the service but must not appear in logs.
    Object.defineProperty(this, "details", {
      enumerable: false,
      value: details,
    });
  }
}

export type ReviewReason =
  | "ANOMALY_DETECTED"
  | "INVALID_CATEGORY"
  | "INVALID_CURRENCY"
  | "INVALID_DOCUMENT_TYPE"
  | "INVALID_LINE_ITEM"
  | "INVALID_MONEY"
  | "INVALID_TRANSACTION_DATE"
  | "LOW_CONFIDENCE"
  | "MISSING_DOCUMENT_TYPE"
  | "MISSING_CURRENCY"
  | "MISSING_SUBTOTAL"
  | "MISSING_SUPPLIER"
  | "MISSING_TOTAL"
  | "MISSING_TRANSACTION_DATE"
  | "MISSING_VAT"
  | "TOTALS_DO_NOT_RECONCILE";

export const normalizedDocumentExtractionSchema = z
  .object({
    anomalies: z.array(z.string().trim().min(1).max(500)).max(50),
    confidence: z.number().min(0).max(1).nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    description: extractedTextSchema,
    documentNumber: extractedTextSchema,
    documentType: z.enum(documentTypes).nullable(),
    lineItems: z
      .array(
        z
          .object({
            description: extractedTextSchema,
            quantity: z.string().regex(exactQuantity).nullable(),
            total: z.string().regex(exactMoney).nullable(),
            unitPrice: z.string().regex(exactMoney).nullable(),
            vat: z.string().regex(exactMoney).nullable(),
          })
          .strict(),
      )
      .max(200),
    paymentMethod: extractedTextSchema,
    reviewReasons: z.array(z.string().trim().min(1).max(100)).max(100),
    subtotal: z.string().regex(exactMoney).nullable(),
    suggestedCategory: extractedTextSchema,
    supplierIdentifier: extractedTextSchema,
    supplierName: extractedTextSchema,
    total: z.string().regex(exactMoney).nullable(),
    transactionDate: z.iso.date().nullable(),
    vat: z.string().regex(exactMoney).nullable(),
  })
  .strict();

export type NormalizedDocumentExtraction = z.infer<
  typeof normalizedDocumentExtractionSchema
>;
export type NormalizedLineItem =
  NormalizedDocumentExtraction["lineItems"][number];

function normalizeMoney(
  value: string | null,
  reasons: Set<ReviewReason>,
): string | null {
  if (value === null) {
    return null;
  }
  if (!exactMoney.test(value)) {
    reasons.add("INVALID_MONEY");
    return null;
  }
  return value;
}

function normalizeLineItem(
  item: AnalyzedDocumentExtraction["lineItems"][number],
  reasons: Set<ReviewReason>,
): NormalizedLineItem {
  const quantity =
    item.quantity === null || exactQuantity.test(item.quantity)
      ? item.quantity
      : null;
  if (item.quantity !== null && quantity === null) {
    reasons.add("INVALID_LINE_ITEM");
  }

  const total = normalizeMoney(item.total, reasons);
  const unitPrice = normalizeMoney(item.unitPrice, reasons);
  const vat = normalizeMoney(item.vat, reasons);
  if (
    (item.total !== null && total === null) ||
    (item.unitPrice !== null && unitPrice === null) ||
    (item.vat !== null && vat === null)
  ) {
    reasons.add("INVALID_LINE_ITEM");
  }

  return {
    description: item.description,
    quantity,
    total,
    unitPrice,
    vat,
  };
}

function toCents(value: string): bigint {
  const [whole, fraction] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction);
}

function normalizeCategory(
  value: string | null,
  categoryNames: readonly string[],
  reasons: Set<ReviewReason>,
): string | null {
  if (value === null) {
    return null;
  }
  const category = categoryNames.find(
    (name) =>
      name.localeCompare(value, undefined, { sensitivity: "accent" }) === 0,
  );
  if (!category) {
    reasons.add("INVALID_CATEGORY");
    return null;
  }
  return category;
}

/**
 * Converts untrusted model output into values the bookkeeping domain can use.
 * Invalid values are cleared and explained rather than inferred.
 */
export function normalizeDocumentExtraction(
  extraction: AnalyzedDocumentExtraction,
  categoryNames: readonly string[],
): NormalizedDocumentExtraction {
  const reasons = new Set<ReviewReason>();
  const documentType = documentTypes.includes(
    extraction.documentType as DocumentType,
  )
    ? (extraction.documentType as DocumentType)
    : null;
  const transactionDate = z.iso.date().safeParse(extraction.transactionDate)
    .success
    ? extraction.transactionDate
    : null;
  const currency = /^[A-Z]{3}$/.test(extraction.currency ?? "")
    ? extraction.currency
    : null;
  const subtotal = normalizeMoney(extraction.subtotal, reasons);
  const vat = normalizeMoney(extraction.vat, reasons);
  const total = normalizeMoney(extraction.total, reasons);
  const suggestedCategory = normalizeCategory(
    extraction.suggestedCategory,
    categoryNames,
    reasons,
  );

  if (extraction.documentType === null) reasons.add("MISSING_DOCUMENT_TYPE");
  else if (documentType === null) reasons.add("INVALID_DOCUMENT_TYPE");
  if (extraction.supplierName === null) reasons.add("MISSING_SUPPLIER");
  if (extraction.transactionDate === null)
    reasons.add("MISSING_TRANSACTION_DATE");
  else if (transactionDate === null) reasons.add("INVALID_TRANSACTION_DATE");
  if (extraction.currency === null) reasons.add("MISSING_CURRENCY");
  else if (currency === null) reasons.add("INVALID_CURRENCY");
  if (extraction.subtotal === null) reasons.add("MISSING_SUBTOTAL");
  if (extraction.vat === null) reasons.add("MISSING_VAT");
  if (extraction.total === null) reasons.add("MISSING_TOTAL");
  if (extraction.confidence < 0 || extraction.confidence > 1) {
    reasons.add("LOW_CONFIDENCE");
  }
  if (extraction.confidence < automaticExtractionConfidenceThreshold) {
    reasons.add("LOW_CONFIDENCE");
  }
  if (extraction.anomalies.length > 0) reasons.add("ANOMALY_DETECTED");
  if (
    subtotal !== null &&
    vat !== null &&
    total !== null &&
    toCents(subtotal) + toCents(vat) !== toCents(total)
  ) {
    reasons.add("TOTALS_DO_NOT_RECONCILE");
  }

  return normalizedDocumentExtractionSchema.parse({
    anomalies: extraction.anomalies,
    confidence:
      extraction.confidence >= 0 && extraction.confidence <= 1
        ? extraction.confidence
        : null,
    currency,
    description: extraction.description,
    documentNumber: extraction.documentNumber,
    documentType,
    lineItems: extraction.lineItems.map((item) =>
      normalizeLineItem(item, reasons),
    ),
    paymentMethod: extraction.paymentMethod,
    reviewReasons: [...reasons],
    subtotal,
    suggestedCategory,
    supplierIdentifier: extraction.supplierIdentifier,
    supplierName: extraction.supplierName,
    total,
    transactionDate,
    vat,
  });
}
