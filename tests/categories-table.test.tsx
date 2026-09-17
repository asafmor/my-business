import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/* The table imports its server actions; the module graph behind them is not
   under test and must not drag "server-only" into a client render. */
vi.mock("server-only", () => ({}));
vi.mock("../src/server/auth/service", () => ({ requireSession: vi.fn() }));
vi.mock("../src/server/db/client", () => ({ getDatabase: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import {
  CategoriesTable,
  confirmTitle,
} from "../src/components/categories/categories-table";
import type { ExpenseCategory } from "../src/domain/categories/types";

function category(overrides: Partial<ExpenseCategory>): ExpenseCategory {
  return {
    active: true,
    description: null,
    id: "cat-1",
    name: "Software",
    sortOrder: 0,
    ...overrides,
  };
}

describe("categories table", () => {
  it("offers deactivate and delete per row, both behind one dialog", () => {
    const markup = renderToStaticMarkup(
      <CategoriesTable categories={[category({})]} />,
    );

    expect(markup).toContain("השבתת Software");
    expect(markup).toContain("מחיקת Software");
    expect(markup.match(/class="confirm-dialog"/g)).toHaveLength(1);
  });
});

describe("confirm title", () => {
  const items = [category({ id: "a", name: "Software" })];

  it("names the one category and counts a batch", () => {
    expect(confirmTitle({ ids: ["a"], verb: "delete" }, items)).toBe(
      "למחוק את “Software”?",
    );
    expect(confirmTitle({ ids: ["a"], verb: "deactivate" }, items)).toBe(
      "להשבית את “Software”?",
    );
    expect(confirmTitle({ ids: ["a", "b"], verb: "deactivate" }, items)).toBe(
      "להשבית 2 קטגוריות?",
    );
  });

  it("is blank while nothing is pending", () => {
    expect(confirmTitle(null, items)).toBe("");
  });
});
