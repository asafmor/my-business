import { humanizeEnumValue } from "./format";

/*
 * Hebrew for the enums the UI shows. Values the database or the AI hands back
 * are shown as they are; only names the app itself defines are mapped here.
 * Anything unlisted (a future enum value) still reads via humanizeEnumValue.
 */

export const appName = "העסק שלי";

const documentTypeLabels: Partial<Record<string, string>> = {
  BANK_STATEMENT: "דף חשבון בנק",
  CERTIFICATE: "אישור",
  CONTRACT: "חוזה",
  CREDIT_NOTE: "חשבונית זיכוי",
  GENERATED_REPORT: "דוח שנוצר",
  INSURANCE_DOCUMENT: "מסמך ביטוח",
  INVOICE_RECEIPT: "חשבונית מס/קבלה",
  OTHER: "אחר",
  RECEIPT: "קבלה",
  SUPPLIER_INVOICE: "חשבונית ספק",
  TAX_DOCUMENT: "מסמך מס",
};

export function documentTypeLabel(type: string): string {
  return documentTypeLabels[type] ?? humanizeEnumValue(type);
}

const documentStatusLabels: Partial<Record<string, string>> = {
  ARCHIVED: "בארכיון",
  FAILED: "נכשל",
  NEEDS_REVIEW: "דורש בדיקה",
  PROCESSING: "בעיבוד",
  READY: "מוכן",
  UPLOADED: "הועלה",
};

export function documentStatusLabel(status: string): string {
  return documentStatusLabels[status] ?? humanizeEnumValue(status);
}

const fileKindLabels: Partial<Record<string, string>> = {
  GENERATED_REPORT: "דוח שנוצר",
  ORIGINAL: "מקור",
  PREVIEW: "תצוגה מקדימה",
};

export function fileKindLabel(kind: string): string {
  return fileKindLabels[kind] ?? humanizeEnumValue(kind);
}

/** "3 מסמכים" / "מסמך אחד": Hebrew counts one thing differently from many. */
export function countOf(count: number, one: string, many: string): string {
  return count === 1 ? one : `${count} ${many}`;
}
