import type { JsonValue } from "./types";
import { formatDate, formatMoney, humanizeEnumValue } from "../../lib/format";

export type AuditFieldChange = {
  field: string | null;
  oldValue: JsonValue | null;
  newValue: JsonValue | null;
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
  if (field && dateFields.has(field)) return formatDate(String(value));
  if (field && percentageFields.has(field)) return `${String(value)}%`;
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
 * values absent, e.g. REVIEW/ARCHIVE events).
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
