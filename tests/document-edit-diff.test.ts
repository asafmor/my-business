import { describe, expect, it } from "vitest";

import {
  defaultEditableExpenseFields,
  diffExpenseEdit,
} from "../src/domain/expenses/edit";
import type { EditableExpenseFields } from "../src/domain/expenses/edit";

const base: EditableExpenseFields = {
  businessUsePercentage: "100",
  categoryId: "c56a4180-65aa-42ec-a945-5fd21dec0538",
  currency: "ILS",
  documentNumber: "INV-1",
  notes: null,
  paymentMethod: "CREDIT_CARD",
  subtotal: "83.00",
  supplierName: "Acme",
  total: "100.00",
  transactionDate: "2026-01-01",
  vat: "17.00",
};

describe("diffExpenseEdit", () => {
  it("returns no changes when nothing differs", () => {
    expect(diffExpenseEdit(base, { ...base })).toEqual([]);
  });

  it("reports changed fields with old and new values", () => {
    const next = { ...base, supplierName: "Acme Ltd", total: "150.00" };
    const changes = diffExpenseEdit(base, next);

    expect(changes).toEqual(
      expect.arrayContaining([
        {
          action: "MANUAL_EDIT",
          auditField: "supplierName",
          column: "supplierName",
          newValue: "Acme Ltd",
          oldValue: "Acme",
        },
        {
          action: "MANUAL_EDIT",
          auditField: "total",
          column: "total",
          newValue: "150.00",
          oldValue: "100.00",
        },
      ]),
    );
    expect(changes).toHaveLength(2);
  });

  it("reports currency, subtotal, and payment method changes as manual edits", () => {
    const next = { ...base, currency: "USD", paymentMethod: "CASH", subtotal: "90.00" };
    const changes = diffExpenseEdit(base, next);

    expect(changes).toEqual(
      expect.arrayContaining([
        {
          action: "MANUAL_EDIT",
          auditField: "currency",
          column: "currency",
          newValue: "USD",
          oldValue: "ILS",
        },
        {
          action: "MANUAL_EDIT",
          auditField: "subtotal",
          column: "subtotal",
          newValue: "90.00",
          oldValue: "83.00",
        },
        {
          action: "MANUAL_EDIT",
          auditField: "paymentMethod",
          column: "paymentMethod",
          newValue: "CASH",
          oldValue: "CREDIT_CARD",
        },
      ]),
    );
    expect(changes).toHaveLength(3);
  });

  it("marks a category change with the CATEGORY_CHANGE action and 'category' audit field", () => {
    const next = { ...base, categoryId: "e1c1c1c1-1111-4111-8111-111111111111" };
    const changes = diffExpenseEdit(base, next);

    expect(changes).toEqual([
      {
        action: "CATEGORY_CHANGE",
        auditField: "category",
        column: "categoryId",
        newValue: "e1c1c1c1-1111-4111-8111-111111111111",
        oldValue: "c56a4180-65aa-42ec-a945-5fd21dec0538",
      },
    ]);
  });

  it("diffs against the default baseline for a newly-created expense", () => {
    const changes = diffExpenseEdit(defaultEditableExpenseFields, base);
    const fields = changes.map((change) => change.column).sort();

    expect(fields).toEqual(
      [
        "categoryId",
        "currency",
        "documentNumber",
        "paymentMethod",
        "subtotal",
        "supplierName",
        "total",
        "transactionDate",
        "vat",
      ].sort(),
    );
  });
});
