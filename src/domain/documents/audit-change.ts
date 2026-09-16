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

export type AuditFieldChange = {
  field: string | null;
  oldValue: JsonValue | null;
  newValue: JsonValue | null;
};

/** What each audited field is called on screen, keyed by its audit name. */
export const fieldLabels: Record<string, string> = {
  businessUsePercentage: "Business use",
  category: "Category",
  categoryId: "Category",
  currency: "Currency",
  documentNumber: "Document number",
  documentType: "Document type",
  notes: "Notes",
  paymentMethod: "Payment method",
  subtotal: "Subtotal",
  supplierName: "Supplier",
  total: "Total",
  transactionDate: "Date",
  type: "Document type",
  vat: "VAT",
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
  if (field && enumFields.has(field)) return humanizeEnumValue(String(value));
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
  return `${before} → ${after}`;
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
  /** Who did it, in the reader's terms. */
  source: "AI" | "System" | "You";
  title: string;
  tone: "danger" | "neutral" | "success" | "warning";
};

const sourceLabels: Record<AuditSource, AuditEntry["source"]> = {
  AI: "AI",
  SYSTEM: "System",
  USER: "You",
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
  const source = sourceLabels[event.source];
  const base = { after: null, before: null, detail: null, source };
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
        title: "Uploaded",
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
          title: again ? "Reprocessing failed" : "Reading failed",
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
          ? reasons.map(reviewReasonSentence).join(" ") || "Needs a look."
          : "Every field was read with confidence.",
        kind: "extraction",
        title: again ? "Read again by AI" : "Read by AI",
        tone: needsReview ? "warning" : "success",
      };
    }
    case "MANUAL_EDIT":
    case "CATEGORY_CHANGE": {
      const label = event.field
        ? (fieldLabels[event.field] ?? humanizeEnumValue(event.field))
        : "Field";
      return {
        ...base,
        after: formatValue(event.newValue, event.field, categoryNameById),
        before: formatValue(event.oldValue, event.field, categoryNameById),
        kind: event.action === "CATEGORY_CHANGE" ? "category" : "edit",
        title: `${label} changed`,
        tone: "neutral",
      };
    }
    case "REVIEW":
      return {
        ...base,
        kind: "review",
        title: "Marked reviewed",
        tone: "success",
      };
    case "ARCHIVE":
      return { ...base, kind: "archive", title: "Archived", tone: "neutral" };
    case "UNARCHIVE":
      return {
        ...base,
        detail:
          typeof event.newValue === "string"
            ? `Back to ${humanizeEnumValue(event.newValue).toLowerCase()}.`
            : null,
        kind: "unarchive",
        title: "Restored from the archive",
        tone: "success",
      };
    case "REPORT_GENERATION":
      return {
        ...base,
        kind: "report",
        title: "Included in a report",
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
