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
  ANOMALY_DETECTED: "זוהתה חריגה אפשרית במסמך.",
  INVALID_CATEGORY: "הקטגוריה המוצעת אינה מוכרת.",
  INVALID_CURRENCY: "לא ניתן היה לקבוע את המטבע.",
  INVALID_DOCUMENT_TYPE: "לא ניתן היה לקבוע את סוג המסמך.",
  INVALID_LINE_ITEM: "לאחת השורות יש ערכים לא תקינים.",
  INVALID_MONEY: "אחד הסכומים אינו תקין.",
  INVALID_TRANSACTION_DATE: "תאריך העסקה אינו תקין.",
  LOW_CONFIDENCE: "רמת הביטחון בחילוץ נמוכה.",
  MISSING_CURRENCY: "לא ניתן היה לקבוע את המטבע.",
  MISSING_DOCUMENT_TYPE: "לא ניתן היה לקבוע את סוג המסמך.",
  MISSING_SUBTOTAL: 'לא ניתן היה לקבוע את הסכום לפני מע"מ.',
  MISSING_SUPPLIER: "לא ניתן היה לקבוע את שם הספק.",
  MISSING_TOTAL: "לא ניתן היה לקבוע את הסכום.",
  MISSING_TRANSACTION_DATE: "לא ניתן היה לקבוע את תאריך העסקה.",
  MISSING_VAT: 'לא ניתן היה לקבוע את המע"מ.',
  SUSPICIOUS_VAT: 'המע"מ שונה מהחישוב הצפוי.',
  TOTALS_DO_NOT_RECONCILE: "הסכומים אינם מתאזנים.",
};

// processingTasks.lastErrorCode values (see FailedProcessing["errorCode"] in
// processing-repository.ts).
const failureReasonText: Partial<Record<string, string>> = {
  ANALYZER_FAILURE: "החילוץ האוטומטי נכשל.",
  INVALID_AI_RESPONSE: "החילוץ האוטומטי החזיר נתונים לא שמישים.",
  STORAGE_FAILURE: "לא ניתן היה לקרוא את הקובץ המקורי.",
};

/** Turns raw review/failure/duplicate signals into SPEC.md-style sentences. */
export function attentionReasons(input: AttentionInput): string[] {
  const reasons: string[] = [];
  if (input.isDuplicate) reasons.push("זוהה כפילות אפשרית.");
  for (const reason of input.reviewReasons) {
    reasons.push(reviewReasonSentence(reason));
  }
  if (input.lastErrorCode) {
    reasons.push(failureReasonSentence(input.lastErrorCode));
  }
  return reasons;
}

export function reviewReasonSentence(reason: string): string {
  return reviewReasonText[reason] ?? `${humanizeEnumValue(reason)}.`;
}

export function failureReasonSentence(errorCode: string): string {
  return failureReasonText[errorCode] ?? `${humanizeEnumValue(errorCode)}.`;
}

// Which edit-form field a review reason is really about, so the detail page
// can flag it in place instead of only listing reasons in a banner. Reasons
// missing here (LOW_CONFIDENCE, ANOMALY_DETECTED, …) are about the document as
// a whole and stay in the banner.
const reviewReasonFields: Partial<Record<string, string>> = {
  INVALID_CATEGORY: "categoryId",
  INVALID_CURRENCY: "currency",
  INVALID_DOCUMENT_TYPE: "documentType",
  INVALID_TRANSACTION_DATE: "transactionDate",
  MISSING_CURRENCY: "currency",
  MISSING_DOCUMENT_TYPE: "documentType",
  MISSING_SUBTOTAL: "subtotal",
  MISSING_SUPPLIER: "supplierName",
  MISSING_TOTAL: "total",
  MISSING_TRANSACTION_DATE: "transactionDate",
  MISSING_VAT: "vat",
  SUSPICIOUS_VAT: "vat",
  TOTALS_DO_NOT_RECONCILE: "total",
};

export function reviewReasonField(reason: string): string | null {
  return reviewReasonFields[reason] ?? null;
}
