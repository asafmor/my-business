import { describe, expect, it } from "vitest";

import {
  normalizeSearchQuery,
  parseDocumentListQuery,
} from "../src/domain/documents/query";

describe("normalizeSearchQuery", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeSearchQuery("  hello   world  ")).toBe("hello world");
  });

  it("returns null for empty or missing input", () => {
    expect(normalizeSearchQuery("")).toBeNull();
    expect(normalizeSearchQuery("   ")).toBeNull();
    expect(normalizeSearchQuery(undefined)).toBeNull();
    expect(normalizeSearchQuery(null)).toBeNull();
  });

  it("truncates to 200 characters", () => {
    const long = "a".repeat(250);
    expect(normalizeSearchQuery(long)).toHaveLength(200);
  });
});

describe("parseDocumentListQuery", () => {
  it("defaults to date-desc sort, page 1, and no filters", () => {
    const query = parseDocumentListQuery({});
    expect(query).toEqual({
      amountMax: null,
      amountMin: null,
      categoryId: null,
      dateFrom: null,
      dateTo: null,
      month: null,
      page: 1,
      q: null,
      sort: "date-desc",
      status: null,
      supplier: null,
      type: null,
    });
  });

  it("parses valid values, including array search params (uses first)", () => {
    const query = parseDocumentListQuery({
      amountMax: "100.50",
      amountMin: "10",
      category: "c56a4180-65aa-42ec-a945-5fd21dec0538",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      page: "3",
      q: ["first search", "second"],
      sort: "total-asc",
      status: "READY",
      supplier: "Acme",
      type: "RECEIPT",
    });

    expect(query).toMatchObject({
      amountMax: "100.50",
      amountMin: "10",
      categoryId: "c56a4180-65aa-42ec-a945-5fd21dec0538",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      page: 3,
      q: "first search",
      sort: "total-asc",
      status: "READY",
      supplier: "Acme",
      type: "RECEIPT",
    });
  });

  it("drops malformed values instead of throwing", () => {
    const query = parseDocumentListQuery({
      amountMin: "not-a-number",
      category: "not-a-uuid",
      dateFrom: "01/01/2026",
      month: "2026",
      page: "-5",
      sort: "bogus-sort",
      status: "NOT_A_STATUS",
      type: "NOT_A_TYPE",
    });

    expect(query).toEqual({
      amountMax: null,
      amountMin: null,
      categoryId: null,
      dateFrom: null,
      dateTo: null,
      month: null,
      page: 1,
      q: null,
      sort: "date-desc",
      status: null,
      supplier: null,
      type: null,
    });
  });

  it("prefers month over dateFrom/dateTo when both are present in the caller", () => {
    // parseDocumentListQuery itself just parses each field independently;
    // month vs date-range precedence is enforced by the query repository.
    const query = parseDocumentListQuery({
      dateFrom: "2026-01-01",
      month: "2026-01",
    });
    expect(query.month).toBe("2026-01");
    expect(query.dateFrom).toBe("2026-01-01");
  });
});
