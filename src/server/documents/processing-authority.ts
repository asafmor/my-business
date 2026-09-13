export type ExtractedExpenseValues = {
  categoryId: string | null;
  currency: string | null;
  documentNumber: string | null;
  notes: string | null;
  paymentMethod: string | null;
  reportingMonth: string | null;
  subtotal: string | null;
  supplierIdentifier: string | null;
  supplierName: string | null;
  total: string | null;
  transactionDate: string | null;
  vat: string | null;
};

const emptyExtractedExpense: ExtractedExpenseValues = {
  categoryId: null,
  currency: null,
  documentNumber: null,
  notes: null,
  paymentMethod: null,
  reportingMonth: null,
  subtotal: null,
  supplierIdentifier: null,
  supplierName: null,
  total: null,
  transactionDate: null,
  vat: null,
};

export function normalizeExpenseField(
  field: string,
): keyof ExtractedExpenseValues | null {
  if (field === "category") return "categoryId";
  if (field === "description") return "notes";
  return field in emptyExtractedExpense
    ? (field as keyof ExtractedExpenseValues)
    : null;
}

/** Preserves accepted user values while allowing fresh AI values elsewhere. */
export function preserveManualExpenseValues(
  existing: ExtractedExpenseValues,
  extracted: ExtractedExpenseValues,
  manualFields: Set<keyof ExtractedExpenseValues | null>,
): ExtractedExpenseValues {
  const result = { ...extracted };
  for (const field of manualFields) {
    if (field !== null) result[field] = existing[field];
  }
  return result;
}
