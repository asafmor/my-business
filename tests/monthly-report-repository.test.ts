import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db/client", () => ({ getDatabase: vi.fn() }));
vi.mock("../src/server/db/schema", () => ({
  categories: { id: "categories.id", name: "categories.name" },
  documents: {
    id: "documents.id",
    status: "documents.status",
    transactionDate: "documents.transaction_date",
    updatedAt: "documents.updated_at",
  },
  expenses: {
    categoryId: "expenses.category_id",
    currency: "expenses.currency",
    documentId: "expenses.document_id",
    subtotal: "expenses.subtotal",
    supplierName: "expenses.supplier_name",
    total: "expenses.total",
    vat: "expenses.vat",
  },
  extractions: {
    createdAt: "extractions.created_at",
    documentId: "extractions.document_id",
    normalizedResult: "extractions.normalized_result",
  },
  processingTasks: {
    documentId: "processing_tasks.document_id",
    lastErrorCode: "processing_tasks.last_error_code",
  },
}));

const { DrizzleMonthlyReportRepository } = await import(
  "../src/server/reports/monthly-report-repository"
);

function chain(result: unknown) {
  const obj: Record<string, unknown> = {};
  for (const method of ["from", "leftJoin", "innerJoin", "where", "groupBy", "orderBy", "limit"]) {
    obj[method] = vi.fn(() => obj);
  }
  (obj as { then: (resolve: (value: unknown) => void) => void }).then = (resolve) =>
    resolve(result);
  return obj;
}

describe("DrizzleMonthlyReportRepository.summary", () => {
  it("uses expenses.subtotal (before VAT) as the net total, separate from the gross total", async () => {
    const selectChain = chain([
      {
        documentCount: 2,
        grossTotal: "121.00",
        netTotal: "100.00",
        reviewProblemCount: 1,
        vatTotal: "21.00",
      },
    ]);
    const database = { select: vi.fn(() => selectChain) };
    const repository = new DrizzleMonthlyReportRepository((() => database) as never);

    await expect(repository.summary("2026-09")).resolves.toEqual({
      documentCount: 2,
      grossTotal: "121.00",
      netTotal: "100.00",
      reviewProblemCount: 1,
      vatTotal: "21.00",
    });
  });

  it("defaults to zeroed totals when nothing matches the month", async () => {
    const database = { select: vi.fn(() => chain([])) };
    const repository = new DrizzleMonthlyReportRepository((() => database) as never);

    await expect(repository.summary("2026-09")).resolves.toEqual({
      documentCount: 0,
      grossTotal: "0",
      netTotal: "0",
      reviewProblemCount: 0,
      vatTotal: "0",
    });
  });
});

describe("DrizzleMonthlyReportRepository.categoryBreakdown / supplierBreakdown", () => {
  it("groups totals by category", async () => {
    const rows = [{ categoryName: "Travel", total: "100.00" }];
    const selectChain = chain(rows);
    const database = { select: vi.fn(() => selectChain) };
    const repository = new DrizzleMonthlyReportRepository((() => database) as never);

    await expect(repository.categoryBreakdown("2026-09")).resolves.toEqual(rows);
  });

  it("groups totals by supplier", async () => {
    const rows = [{ supplierName: "Acme", total: "50.00" }];
    const selectChain = chain(rows);
    const database = { select: vi.fn(() => selectChain) };
    const repository = new DrizzleMonthlyReportRepository((() => database) as never);

    await expect(repository.supplierBreakdown("2026-09")).resolves.toEqual(rows);
  });
});

describe("DrizzleMonthlyReportRepository.problematicDocuments", () => {
  it("attaches review reasons from the latest extraction", async () => {
    const documentRows = [
      {
        currency: "ILS",
        id: "doc-1",
        isDuplicate: false,
        lastErrorCode: null,
        status: "NEEDS_REVIEW",
        supplierName: "Acme",
        total: "10.00",
        transactionDate: "2026-09-01",
      },
    ];
    const extractionRows = [
      {
        createdAt: new Date("2026-09-02"),
        documentId: "doc-1",
        normalizedResult: { reviewReasons: ["MISSING_VAT"] },
      },
    ];
    let selectCall = 0;
    const database = {
      select: vi.fn(() => {
        selectCall += 1;
        return chain(selectCall === 1 ? documentRows : extractionRows);
      }),
    };
    const repository = new DrizzleMonthlyReportRepository((() => database) as never);

    await expect(repository.problematicDocuments("2026-09")).resolves.toEqual([
      { ...documentRows[0], reviewReasons: ["MISSING_VAT"] },
    ]);
  });
});
