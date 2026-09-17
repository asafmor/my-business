import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

import { formatDateTime, formatMoney, formatMonth } from "../../lib/format";

import type {
  CategoryBreakdownRow,
  MonthlySummary,
  SupplierBreakdownRow,
} from "./monthly-report-repository";

const fontsDirectory = path.join(process.cwd(), "src/server/reports/fonts");

// DejaVu Sans covers Hebrew (and most of Latin/Cyrillic), unlike pdf-lib's
// built-in WinAnsi-only standard fonts — the report's own labels are Hebrew,
// and so are most supplier/category names from real documents.
async function loadFonts(pdf: PDFDocument) {
  pdf.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(fontsDirectory, "DejaVuSans.ttf")),
    readFile(path.join(fontsDirectory, "DejaVuSans-Bold.ttf")),
  ]);
  return {
    bold: await pdf.embedFont(boldBytes),
    regular: await pdf.embedFont(regularBytes),
  };
}

// ponytail: a right-to-left line for pdf-lib's left-to-right drawText. Strong
// left-to-right runs - digits, Latin, and the punctuation and spaces between
// them - keep their order; everything else (Hebrew and the neutrals around it)
// is reversed character by character, and the runs are laid out right to
// left. This is not the full Unicode Bidi Algorithm: nested directions and
// paired brackets can still come out wrong. Swap in bidi-js if that shows up.
const ltrRun = /[A-Za-z0-9](?:[A-Za-z0-9 .,:;%$€£₪/-]*[A-Za-z0-9%])?/g;

function reverse(text: string): string {
  return [...text].reverse().join("");
}

export function toVisualOrder(text: string): string {
  const parts: string[] = [];
  let last = 0;
  for (const match of text.matchAll(ltrRun)) {
    if (match.index > last) parts.push(reverse(text.slice(last, match.index)));
    parts.push(match[0]);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(reverse(text.slice(last)));
  return parts.reverse().join("");
}

export type MonthlyReportPdfInput = {
  month: string;
  summary: MonthlySummary;
  categoryBreakdown: CategoryBreakdownRow[];
  supplierBreakdown: SupplierBreakdownRow[];
  generatedAt: Date;
};

const pageWidth = 595.28; // A4 points
const pageHeight = 841.89;
const margin = 50;
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
  const { regular: font, bold } = await loadFonts(pdf);
  const page = pdf.addPage([pageWidth, pageHeight]);

  let y = pageHeight - 60;
  /* Right-aligned: each line ends at the right margin, as Hebrew reads. */
  const write = (
    text: string,
    options?: { bold?: boolean; size?: number; gap?: number },
  ) => {
    const face = options?.bold ? bold : font;
    const size = options?.size ?? 11;
    const visual = toVisualOrder(text);
    page.drawText(visual, {
      color: rgb(0.1, 0.1, 0.1),
      font: face,
      size,
      x: pageWidth - margin - face.widthOfTextAtSize(visual, size),
      y,
    });
    y -= options?.gap ?? lineGap;
  };

  write(`דוח הוצאות חודשי — ${formatMonth(input.month)}`, {
    bold: true,
    size: 18,
    gap: 26,
  });
  write(`נוצר ב־${formatDateTime(input.generatedAt)}`, { size: 9, gap: 24 });

  write("סיכום", { bold: true, size: 13, gap: 20 });
  write(`מסמכים: ${input.summary.documentCount}`);
  write(`סך ההוצאות (ברוטו): ${formatMoney(input.summary.grossTotal, null)}`);
  write(`הוצאות לפני מע"מ (נטו): ${formatMoney(input.summary.netTotal, null)}`);
  write(`מע"מ: ${formatMoney(input.summary.vatTotal, null)}`);
  write(`מסמכים שדורשים בדיקה: ${input.summary.reviewProblemCount}`, {
    gap: 24,
  });

  write("לפי קטגוריה", { bold: true, size: 13, gap: 20 });
  if (input.categoryBreakdown.length === 0) {
    write("לא נרשמו הוצאות.", { gap: 24 });
  } else {
    for (const row of input.categoryBreakdown) {
      write(
        `${row.categoryName ?? "ללא קטגוריה"}: ${formatMoney(row.total, null)}`,
      );
    }
    y -= 8;
  }

  write("לפי ספק", { bold: true, size: 13, gap: 20 });
  if (input.supplierBreakdown.length === 0) {
    write("לא נרשמו הוצאות.");
  } else {
    for (const row of input.supplierBreakdown) {
      write(
        `${row.supplierName ?? "ספק לא ידוע"}: ${formatMoney(row.total, null)}`,
      );
    }
  }

  return pdf.save();
}
