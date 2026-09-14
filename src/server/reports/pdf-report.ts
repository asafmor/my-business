import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { formatDateTime, formatMoney } from "../../lib/format";

import type {
  CategoryBreakdownRow,
  MonthlySummary,
  SupplierBreakdownRow,
} from "./monthly-report-repository";

export type MonthlyReportPdfInput = {
  month: string;
  summary: MonthlySummary;
  categoryBreakdown: CategoryBreakdownRow[];
  supplierBreakdown: SupplierBreakdownRow[];
  generatedAt: Date;
};

const pageWidth = 595.28; // A4 points
const pageHeight = 841.89;
const leftMargin = 50;
const lineGap = 16;

/**
 * Builds a simple printable one-page-per-section summary PDF. No pagination:
 * ponytail — long category/supplier lists will run off the bottom of the
 * page; add page-break handling if a month regularly has dozens of them.
 */
export async function buildMonthlyReportPdf(
  input: MonthlyReportPdfInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([pageWidth, pageHeight]);

  let y = pageHeight - 60;
  const write = (text: string, options?: { bold?: boolean; size?: number; gap?: number }) => {
    page.drawText(text, {
      color: rgb(0.1, 0.1, 0.1),
      font: options?.bold ? bold : font,
      size: options?.size ?? 11,
      x: leftMargin,
      y,
    });
    y -= options?.gap ?? lineGap;
  };

  write(`Monthly expense report — ${input.month}`, { bold: true, size: 18, gap: 26 });
  write(`Generated ${formatDateTime(input.generatedAt)}`, { size: 9, gap: 24 });

  write("Summary", { bold: true, size: 13, gap: 20 });
  write(`Documents: ${input.summary.documentCount}`);
  write(`Total expenses (gross): ${formatMoney(input.summary.grossTotal, null)}`);
  write(`Expenses before VAT (net): ${formatMoney(input.summary.netTotal, null)}`);
  write(`VAT: ${formatMoney(input.summary.vatTotal, null)}`);
  write(`Documents needing review: ${input.summary.reviewProblemCount}`, { gap: 24 });

  write("By category", { bold: true, size: 13, gap: 20 });
  if (input.categoryBreakdown.length === 0) {
    write("No expenses recorded.", { gap: 24 });
  } else {
    for (const row of input.categoryBreakdown) {
      write(`${row.categoryName ?? "Uncategorized"}: ${formatMoney(row.total, null)}`);
    }
    y -= 8;
  }

  write("By supplier", { bold: true, size: 13, gap: 20 });
  if (input.supplierBreakdown.length === 0) {
    write("No expenses recorded.");
  } else {
    for (const row of input.supplierBreakdown) {
      write(`${row.supplierName ?? "Unknown supplier"}: ${formatMoney(row.total, null)}`);
    }
  }

  return pdf.save();
}
