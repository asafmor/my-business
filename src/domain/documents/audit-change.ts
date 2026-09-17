import {
  failureReasonSentence,
  reviewReasonSentence,
} from "./attention-reasons";
import type { AuditAction, AuditSource, JsonValue } from "./types";
import {
  formatBytes,
  formatDateLong,
  formatMoney,
  humanizeEnumValue,
} from "../../lib/format";
import { documentStatusLabel, documentTypeLabel } from "../../lib/labels";

export type AuditFieldChange = {
  field: string | null;
  oldValue: JsonValue | null;
  newValue: JsonValue | null;
};

/** What each audited field is called on screen, keyed by its audit name. */
export const fieldLabels: Record<string, string> = {
  businessUsePercentage: "שימוש עסקי",
  category: "קטגוריה",
  categoryId: "קטגוריה",
  currency: "מטבע",
  documentNumber: "מספר מסמך",
  documentType: "סוג מסמך",
  notes: "הערות",
  paymentMethod: "אמצעי תשלום",
  subtotal: 'לפני מע"מ',
  supplierName: "ספק",
  total: 'סה"כ',
  transactionDate: "תאריך",
  type: "סוג מסמך",
  vat: 'מע"מ',
};

// auditField names from editableExpenseFieldMap (domain/expenses/edit.ts) and
// document-detail-repository's saveEdit. Anything not listed falls back to a
// plain string / JSON.stringify, so this only needs entries where the raw
// value needs reshaping to read well.
const moneyFields = new Set(["subtotal", "total", "vat"]);
const dateFields = new Set(["transactionDate"]);
const percentageFields = new Set(["businessUsePercentage"]);
const enumFields = new Set(["type"]);

function formatValue(
  value: JsonValue | null,
  field: string | null,
  categoryNameById: Record<string, string>,
): string {
  if (value === null) return "—";
  if (field && moneyFields.has(field)) return formatMoney(String(value), null);
  if (field && dateFields.has(field)) return formatDateLong(String(value));
  if (field && percentageFields.has(field)) {
    return `${Number(value) || 0}%`;
  }
  if (field && enumFields.has(field)) return documentTypeLabel(String(value));
  // CATEGORY_CHANGE audit rows store the category id (see editableExpenseFieldMap's
  // "category" -> categoryId mapping); resolve it to a name when we have one on
  // hand rather than querying for it.
  if (field === "category") {
    const id = String(value);
    return categoryNameById[id] ?? id;
  }
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/**
 * Turns an audit event's field + old/new value into a human-readable
 * "before → after" string. Returns null when there is nothing to show (both
 * values absent, e.g. REVIEW events).
 */
export function formatAuditChange(
  change: AuditFieldChange,
  categoryNameById: Record<string, string> = {},
): string | null {
  if (change.oldValue === null && change.newValue === null) return null;
  const before = formatValue(change.oldValue, change.field, categoryNameById);
  const after = formatValue(change.newValue, change.field, categoryNameById);
  return `${before} ← ${after}`;
}

export type AuditEntryKind =
  | "archive"
  | "category"
  | "edit"
  | "extraction"
  | "failure"
  | "report"
  | "review"
  | "unarchive"
  | "upload";

export type AuditEntry = {
  /** The value after the change, already formatted; null when not a field change. */
  after: string | null;
  before: string | null;
  /** One sentence under the title, or null when the title says it all. */
  detail: string | null;
  kind: AuditEntryKind;
  /** Who did it, as the CSS tone key; sourceLabel is the word on screen. */
  source: "AI" | "System" | "You";
  sourceLabel: string;
  title: string;
  tone: "danger" | "neutral" | "success" | "warning";
};

const sources: Record<
  AuditSource,
  Pick<AuditEntry, "source" | "sourceLabel">
> = {
  AI: { source: "AI", sourceLabel: "AI" },
  SYSTEM: { source: "System", sourceLabel: "המערכת" },
  USER: { source: "You", sourceLabel: "אתם" },
};

function asObject(value: JsonValue | null): Record<string, JsonValue> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

/**
 * Reads an audit row the way the activity feed shows it: a verb for a title,
 * a sentence of detail, and a formatted before/after for field changes. The
 * payload shapes come from upload-service.ts (UPLOAD), processing-repository.ts
 * (EXTRACTION / REPROCESSING) and document-detail-repository.ts (the rest).
 */
export function describeAuditEvent(
  event: AuditFieldChange & { action: AuditAction; source: AuditSource },
  categoryNameById: Record<string, string> = {},
): AuditEntry {
  const base = {
    after: null,
    before: null,
    detail: null,
    ...sources[event.source],
  };
  const payload = asObject(event.newValue);

  switch (event.action) {
    case "UPLOAD": {
      const name =
        typeof payload?.fileName === "string" ? payload.fileName : null;
      const size =
        typeof payload?.sizeBytes === "number"
          ? formatBytes(payload.sizeBytes)
          : null;
      return {
        ...base,
        detail: [name, size].filter(Boolean).join(" · ") || null,
        kind: "upload",
        title: "הועלה",
        tone: "neutral",
      };
    }
    case "EXTRACTION":
    case "REPROCESSING": {
      const again = event.action === "REPROCESSING";
      if (typeof payload?.failure === "string") {
        return {
          ...base,
          detail: failureReasonSentence(payload.failure),
          kind: "failure",
          title: again ? "העיבוד החוזר נכשל" : "הקריאה נכשלה",
          tone: "danger",
        };
      }
      const reasons = Array.isArray(payload?.reviewReasons)
        ? payload.reviewReasons.filter(
            (reason): reason is string => typeof reason === "string",
          )
        : [];
      const needsReview = payload?.status === "NEEDS_REVIEW";
      return {
        ...base,
        detail: needsReview
          ? reasons.map(reviewReasonSentence).join(" ") || "דורש בדיקה."
          : "כל השדות נקראו בביטחון.",
        kind: "extraction",
        title: again ? "נקרא מחדש על ידי AI" : "נקרא על ידי AI",
        tone: needsReview ? "warning" : "success",
      };
    }
    case "MANUAL_EDIT":
    case "CATEGORY_CHANGE": {
      const label = event.field
        ? (fieldLabels[event.field] ?? humanizeEnumValue(event.field))
        : "שדה";
      return {
        ...base,
        after: formatValue(event.newValue, event.field, categoryNameById),
        before: formatValue(event.oldValue, event.field, categoryNameById),
        kind: event.action === "CATEGORY_CHANGE" ? "category" : "edit",
        title: `${label} השתנה`,
        tone: "neutral",
      };
    }
    case "REVIEW":
      return {
        ...base,
        kind: "review",
        title: "סומן כנבדק",
        tone: "success",
      };
    case "ARCHIVE":
      return {
        ...base,
        kind: "archive",
        title: "הועבר לארכיון",
        tone: "neutral",
      };
    case "UNARCHIVE":
      return {
        ...base,
        detail:
          typeof event.newValue === "string"
            ? `חזר למצב "${documentStatusLabel(event.newValue)}".`
            : null,
        kind: "unarchive",
        title: "שוחזר מהארכיון",
        tone: "success",
      };
    case "REPORT_GENERATION":
      return {
        ...base,
        kind: "report",
        title: "נכלל בדוח",
        tone: "neutral",
      };
    default:
      return {
        ...base,
        kind: "edit",
        title: humanizeEnumValue(event.action),
        tone: "neutral",
      };
  }
}
