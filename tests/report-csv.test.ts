import { describe, expect, it } from "vitest";

import { buildReportCsv, reportCsvColumns } from "../src/domain/reports/csv";
import type { ReportCsvRow } from "../src/domain/reports/csv";

const rows: ReportCsvRow[] = [
  {
    categoryName: "Travel",
    id: "doc-1",
    status: "READY",
    subtotal: "100.00",
    supplierName: "Acme, Inc.",
    total: "121.00",
    transactionDate: "2026-09-01",
    vat: "21.00",
  },
  {
    categoryName: null,
    id: "doc-2",
    status: "NEEDS_REVIEW",
    subtotal: null,
    supplierName: 'Say "hi"\nnext line',
    total: null,
    transactionDate: null,
    vat: null,
  },
];

describe("buildReportCsv", () => {
  it("starts with a UTF-8 BOM and uses CRLF line endings", () => {
    const csv = buildReportCsv(rows);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split("\r\n").length).toBeGreaterThan(1);
  });

  it("writes the documented, stable column header", () => {
    const csv = buildReportCsv([]);
    const header = csv.slice(1).split("\r\n")[0];
    expect(header).toBe(reportCsvColumns.join(","));
  });

  it("escapes commas, quotes, and embedded newlines", () => {
    const csv = buildReportCsv(rows);
    expect(csv).toContain('"Acme, Inc."');
    expect(csv).toContain('"Say ""hi""\nnext line"');
  });

  it("renders nulls as empty fields, not the literal 'null'", () => {
    const csv = buildReportCsv(rows);
    expect(csv).not.toContain("null");
  });

  it("is deterministic: the same rows always produce the same CSV", () => {
    expect(buildReportCsv(rows)).toBe(buildReportCsv(rows));
  });

  it("totals in the CSV reproduce the totals of the source rows", () => {
    // No commas/quotes in these fields, so a plain split is a valid parser here.
    const plainRows: ReportCsvRow[] = [
      { ...rows[0], supplierName: "Acme" },
      { ...rows[1], supplierName: "Other", total: "5.00" },
    ];
    const csv = buildReportCsv(plainRows);
    const dataLines = csv.slice(1).split("\r\n").slice(1, -1);
    const sumFromCsv = dataLines.reduce((sum, line) => {
      const total = line.split(",")[6];
      return sum + (total ? Number(total) : 0);
    }, 0);
    const sumFromRows = plainRows.reduce(
      (sum, row) => sum + (row.total ? Number(row.total) : 0),
      0,
    );
    expect(sumFromCsv).toBe(sumFromRows);
  });
});
