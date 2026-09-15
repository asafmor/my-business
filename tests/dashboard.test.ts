import { describe, expect, it, vi } from "vitest";

import { currentReportingMonth } from "../src/domain/documents/dashboard";

describe("currentReportingMonth", () => {
  it("formats the given date as YYYY-MM in UTC", () => {
    expect(currentReportingMonth(new Date("2026-09-14T12:00:00Z"))).toBe(
      "2026-09",
    );
  });

  it("pads single-digit months", () => {
    expect(currentReportingMonth(new Date("2026-01-05T00:00:00Z"))).toBe(
      "2026-01",
    );
  });

  it("rolls over at the year boundary using UTC, not local time", () => {
    expect(currentReportingMonth(new Date("2025-12-31T23:30:00Z"))).toBe(
      "2025-12",
    );
    expect(currentReportingMonth(new Date("2026-01-01T00:30:00Z"))).toBe(
      "2026-01",
    );
  });
});

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db/client", () => ({ getDatabase: vi.fn() }));
vi.mock("../src/server/db/schema", () => ({
  categories: { id: "categories.id", name: "categories.name" },
  documents: {
    createdAt: "documents.created_at",
    id: "documents.id",
    status: "documents.status",
    transactionDate: "documents.transaction_date",
    updatedAt: "documents.updated_at",
  },
  expenses: {
    categoryId: "expenses.category_id",
    documentId: "expenses.document_id",
    supplierName: "expenses.supplier_name",
    total: "expenses.total",
    vat: "expenses.vat",
  },
}));

const { DrizzleDashboardRepository } =
  await import("../src/server/documents/dashboard-repository");

function chain(result: unknown) {
  const obj: Record<string, unknown> = {};
  for (const method of [
    "from",
    "leftJoin",
    "innerJoin",
    "where",
    "groupBy",
    "orderBy",
    "limit",
  ]) {
    obj[method] = vi.fn(() => obj);
  }
  (obj as { then: (resolve: (value: unknown) => void) => void }).then = (
    resolve,
  ) => resolve(result);
  return obj;
}

describe("DrizzleDashboardRepository.summary", () => {
  it("returns the current-month aggregate row", async () => {
    const selectChain = chain([
      {
        documentCount: 3,
        needsReviewCount: 1,
        totalExpenses: "150.00",
        vatTotal: "25.00",
      },
    ]);
    const database = { select: vi.fn(() => selectChain) };
    const repository = new DrizzleDashboardRepository(
      (() => database) as never,
    );

    await expect(repository.summary("2026-09")).resolves.toEqual({
      documentCount: 3,
      needsReviewCount: 1,
      totalExpenses: "150.00",
      vatTotal: "25.00",
    });
  });

  it("defaults to zeroed totals when no rows match the month", async () => {
    const selectChain = chain([]);
    const database = { select: vi.fn(() => selectChain) };
    const repository = new DrizzleDashboardRepository(
      (() => database) as never,
    );

    await expect(repository.summary("2026-09")).resolves.toEqual({
      documentCount: 0,
      needsReviewCount: 0,
      totalExpenses: "0",
      vatTotal: "0",
    });
  });
});

describe("DrizzleDashboardRepository.categoryBreakdown", () => {
  it("groups totals by category, including uncategorized", async () => {
    const rows = [
      { categoryName: "Travel", total: "100.00" },
      { categoryName: null, total: "40.00" },
    ];
    const selectChain = chain(rows);
    const database = { select: vi.fn(() => selectChain) };
    const repository = new DrizzleDashboardRepository(
      (() => database) as never,
    );

    await expect(repository.categoryBreakdown("2026-09")).resolves.toEqual(
      rows,
    );
    expect(selectChain.groupBy).toHaveBeenCalledOnce();
  });
});

describe("DrizzleDashboardRepository.hasAnyDocuments", () => {
  it("is false when no documents exist yet", async () => {
    const database = { select: vi.fn(() => chain([])) };
    const repository = new DrizzleDashboardRepository(
      (() => database) as never,
    );

    await expect(repository.hasAnyDocuments()).resolves.toBe(false);
  });

  it("is true once at least one document exists", async () => {
    const database = { select: vi.fn(() => chain([{ id: "doc-1" }])) };
    const repository = new DrizzleDashboardRepository(
      (() => database) as never,
    );

    await expect(repository.hasAnyDocuments()).resolves.toBe(true);
  });
});
