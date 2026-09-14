import { humanizeEnumValue } from "../../lib/format";

export type AttentionInput = {
  isDuplicate: boolean;
  lastErrorCode: string | null;
  reviewReasons: readonly string[];
};

// Human-readable text for the ReviewReason enum (document-analyzer.ts) and
// review-rules.ts. Anything not listed here (a future enum value) still
// degrades to readable text via humanizeEnumValue, so this map only needs
// entries where the enum name alone reads awkwardly.
const reviewReasonText: Partial<Record<string, string>> = {
  ANOMALY_DETECTED: "Possible anomaly detected in this document.",
  INVALID_CATEGORY: "Suggested category is not recognized.",
  INVALID_CURRENCY: "Currency could not be determined.",
  INVALID_DOCUMENT_TYPE: "Document type could not be determined.",
  INVALID_LINE_ITEM: "A line item has invalid values.",
  INVALID_MONEY: "An amount value is invalid.",
  INVALID_TRANSACTION_DATE: "Transaction date is invalid.",
  LOW_CONFIDENCE: "Extraction confidence is low.",
  MISSING_CURRENCY: "Currency could not be determined.",
  MISSING_DOCUMENT_TYPE: "Document type could not be determined.",
  MISSING_SUBTOTAL: "Subtotal could not be determined.",
  MISSING_SUPPLIER: "Supplier name could not be determined.",
  MISSING_TOTAL: "Amount could not be determined.",
  MISSING_TRANSACTION_DATE: "Transaction date could not be determined.",
  MISSING_VAT: "VAT could not be determined.",
  SUSPICIOUS_VAT: "VAT differs from the expected calculation.",
  TOTALS_DO_NOT_RECONCILE: "Totals do not reconcile.",
};

// processingTasks.lastErrorCode values (see FailedProcessing["errorCode"] in
// processing-repository.ts).
const failureReasonText: Partial<Record<string, string>> = {
  ANALYZER_FAILURE: "Automatic extraction failed.",
  INVALID_AI_RESPONSE: "Automatic extraction returned unusable data.",
  STORAGE_FAILURE: "The original file could not be read.",
};

/** Turns raw review/failure/duplicate signals into SPEC.md-style sentences. */
export function attentionReasons(input: AttentionInput): string[] {
  const reasons: string[] = [];
  if (input.isDuplicate) reasons.push("Possible duplicate detected.");
  for (const reason of input.reviewReasons) {
    reasons.push(reviewReasonText[reason] ?? `${humanizeEnumValue(reason)}.`);
  }
  if (input.lastErrorCode) {
    reasons.push(
      failureReasonText[input.lastErrorCode] ??
        `${humanizeEnumValue(input.lastErrorCode)}.`,
    );
  }
  return reasons;
}
