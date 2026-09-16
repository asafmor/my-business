import { describe, expect, it } from "vitest";

import { formatAuditChange } from "../src/domain/documents/audit-change";

describe("formatAuditChange", () => {
  it("returns null when both values are absent", () => {
    expect(
      formatAuditChange({ field: null, newValue: null, oldValue: null }),
    ).toBeNull();
  });

  it("formats money fields without quotes", () => {
    expect(
      formatAuditChange({
        field: "total",
        newValue: "123.45",
        oldValue: "100.00",
      }),
    ).toBe("100.00 → 123.45");
  });

  it("formats date fields as dates", () => {
    expect(
      formatAuditChange({
        field: "transactionDate",
        newValue: "2024-02-01",
        oldValue: "2024-01-15",
      }),
    ).toBe("15 Jan 2024 → 1 Feb 2024");
  });

  it("appends a percent sign for the business-use percentage field", () => {
    expect(
      formatAuditChange({
        field: "businessUsePercentage",
        newValue: "50",
        oldValue: "100",
      }),
    ).toBe("100% → 50%");
  });

  it("humanizes enum-like document type values", () => {
    expect(
      formatAuditChange({
        field: "type",
        newValue: "RECEIPT",
        oldValue: "INVOICE",
      }),
    ).toBe("Invoice → Receipt");
  });

  it("resolves category ids to names when available", () => {
    expect(
      formatAuditChange(
        { field: "category", newValue: "cat-2", oldValue: "cat-1" },
        { "cat-1": "Travel", "cat-2": "Meals" },
      ),
    ).toBe("Travel → Meals");
  });

  it("falls back to the raw id when no category name is available", () => {
    expect(
      formatAuditChange({
        field: "category",
        newValue: "cat-2",
        oldValue: null,
      }),
    ).toBe("— → cat-2");
  });

  it("shows plain strings without JSON quoting", () => {
    expect(
      formatAuditChange({
        field: "supplierName",
        newValue: "Acme Inc",
        oldValue: null,
      }),
    ).toBe("— → Acme Inc");
  });

  it("falls back to JSON for object values with no known field", () => {
    expect(
      formatAuditChange({
        field: null,
        newValue: { status: "READY" },
        oldValue: null,
      }),
    ).toBe('— → {"status":"READY"}');
  });
});
