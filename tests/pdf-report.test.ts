import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildMonthlyReportPdf,
  toVisualOrder,
} from "../src/server/reports/pdf-report";

// Regression test: pdf-lib's standard WinAnsi-only fonts throw on any
// character outside Latin-1 (e.g. Hebrew), which crashed report generation
// for real documents with Hebrew supplier/category names.
describe("buildMonthlyReportPdf", () => {
  it("renders Hebrew supplier and category names without throwing", async () => {
    const bytes = await buildMonthlyReportPdf({
      categoryBreakdown: [{ categoryName: "ציוד משרדי", total: "118.00" }],
      generatedAt: new Date("2026-09-14T12:00:00Z"),
      month: "2026-09",
      summary: {
        documentCount: 1,
        grossTotal: "118.00",
        netTotal: "100.00",
        reviewProblemCount: 0,
        vatTotal: "18.00",
      },
      supplierBreakdown: [{ supplierName: 'חברת בדיקה בע"מ', total: "118.00" }],
    });

    expect(bytes.length).toBeGreaterThan(0);
    // %PDF header confirms a real PDF document was produced.
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });
});

describe("toVisualOrder", () => {
  it("reverses Hebrew runs and lays runs out right to left", () => {
    // Logical "אב: 12" reads, right to left, as "12 :בא" for a LTR drawer.
    expect(toVisualOrder("אב: 12")).toBe("12 :בא");
  });

  it("keeps digits and Latin in their own order", () => {
    expect(toVisualOrder("Acme 1,200.00")).toBe("Acme 1,200.00");
    expect(toVisualOrder("סך: ₪ 1,200.00")).toBe("1,200.00 ₪ :ךס");
  });
});
