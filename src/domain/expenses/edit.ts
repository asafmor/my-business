export type EditableExpenseFields = {
  businessUsePercentage: string;
  categoryId: string | null;
  currency: string | null;
  documentNumber: string | null;
  notes: string | null;
  paymentMethod: string | null;
  subtotal: string | null;
  supplierName: string | null;
  total: string | null;
  transactionDate: string | null;
  vat: string | null;
};

export const defaultEditableExpenseFields: EditableExpenseFields = {
  businessUsePercentage: "100",
  categoryId: null,
  currency: null,
  documentNumber: null,
  notes: null,
  paymentMethod: null,
  subtotal: null,
  supplierName: null,
  total: null,
  transactionDate: null,
  vat: null,
};

export type ExpenseFieldChange = {
  action: "CATEGORY_CHANGE" | "MANUAL_EDIT";
  auditField: string;
  column: keyof EditableExpenseFields;
  newValue: string | null;
  oldValue: string | null;
};

// The audit field name for category matches processing-authority's
// normalizeExpenseField mapping ("category" -> categoryId), so a manual
// category edit here is recognized as a manual field by reprocessing too.
const editableExpenseFieldMap: {
  action: ExpenseFieldChange["action"];
  auditField: string;
  column: keyof EditableExpenseFields;
}[] = [
  { action: "MANUAL_EDIT", auditField: "supplierName", column: "supplierName" },
  {
    action: "MANUAL_EDIT",
    auditField: "documentNumber",
    column: "documentNumber",
  },
  {
    action: "MANUAL_EDIT",
    auditField: "transactionDate",
    column: "transactionDate",
  },
  { action: "MANUAL_EDIT", auditField: "currency", column: "currency" },
  { action: "MANUAL_EDIT", auditField: "subtotal", column: "subtotal" },
  { action: "MANUAL_EDIT", auditField: "total", column: "total" },
  { action: "MANUAL_EDIT", auditField: "vat", column: "vat" },
  {
    action: "MANUAL_EDIT",
    auditField: "paymentMethod",
    column: "paymentMethod",
  },
  { action: "CATEGORY_CHANGE", auditField: "category", column: "categoryId" },
  {
    action: "MANUAL_EDIT",
    auditField: "businessUsePercentage",
    column: "businessUsePercentage",
  },
  { action: "MANUAL_EDIT", auditField: "notes", column: "notes" },
];

/** Compares accepted expense values, returning only fields the user actually changed. */
export function diffExpenseEdit(
  existing: EditableExpenseFields,
  next: EditableExpenseFields,
): ExpenseFieldChange[] {
  return editableExpenseFieldMap
    .filter(({ column }) => existing[column] !== next[column])
    .map(({ action, auditField, column }) => ({
      action,
      auditField,
      column,
      newValue: next[column],
      oldValue: existing[column],
    }));
}
