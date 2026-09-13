export type Money = string;
export type Percentage = string;

export interface Expense {
  id: string;
  documentId: string;
  supplierName: string | null;
  supplierIdentifier: string | null;
  documentNumber: string | null;
  transactionDate: string | null;
  currency: string | null;
  subtotal: Money | null;
  vat: Money | null;
  total: Money | null;
  categoryId: string | null;
  businessUsePercentage: Percentage;
  deductibleVatPercentage: Percentage;
  notes: string | null;
  paymentMethod: string | null;
  reportingMonth: string | null;
  createdAt: Date;
  updatedAt: Date;
}
