/**
 * Stable CSV column schema for the monthly expense export (SPEC.md 9.2).
 * Adding a column is fine; reordering or removing one is a breaking change
 * for anyone who has built a downstream import around it.
 */
export const reportCsvColumns = [
  "מזהה מסמך",
  "ספק",
  "תאריך",
  "קטגוריה",
  "לפני מע״מ",
  "מע״מ",
  "סה״כ",
  "סטטוס",
] as const;

export type ReportCsvRow = {
  id: string;
  supplierName: string | null;
  transactionDate: string | null;
  categoryName: string | null;
  subtotal: string | null;
  vat: string | null;
  total: string | null;
  status: string;
};

function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toLine(values: readonly (string | null)[]): string {
  return values.map((value) => escapeCsvField(value ?? "")).join(",");
}

/**
 * Renders rows as CSV with a UTF-8 BOM and CRLF line endings, the pragmatic
 * default for opening cleanly in Excel and Google Sheets (SPEC.md 9.2, 9.4).
 */
export function buildReportCsv(rows: readonly ReportCsvRow[]): string {
  const lines = [
    toLine(reportCsvColumns),
    ...rows.map((row) =>
      toLine([
        row.id,
        row.supplierName,
        row.transactionDate,
        row.categoryName,
        row.subtotal,
        row.vat,
        row.total,
        row.status,
      ]),
    ),
  ];
  const byteOrderMark = "﻿";
  return byteOrderMark + lines.join("\r\n") + "\r\n";
}
