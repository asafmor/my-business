import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildMonthlyReportPdf } from "../src/server/reports/pdf-report";

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
