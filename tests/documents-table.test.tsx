import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/* The table imports its server actions; the module graph behind them is not
   under test and must not drag "server-only" into a client render. */
vi.mock("server-only", () => ({}));
vi.mock("../src/server/auth/service", () => ({ requireSession: vi.fn() }));
vi.mock("../src/server/db/client", () => ({ getDatabase: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/documents",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import {
  DocumentsTable,
  nextSort,
} from "../src/components/documents/documents-table";
import type { DocumentListRow } from "../src/server/documents/documents-query-repository";

function row(overrides: Partial<DocumentListRow>): DocumentListRow {
  return {
    categoryName: "Software",
    documentNumber: "INV-1",
    id: "doc-1",
    mimeType: "application/pdf",
    status: "READY",
    supplierName: "Acme",
    total: "120.00",
    transactionDate: "2026-01-04",
    type: "SUPPLIER_INVOICE",
    vat: "20.00",
    ...overrides,
  };
}

function render(rows: DocumentListRow[]) {
  return renderToStaticMarkup(
    <DocumentsTable categories={[]} rows={rows} sort="date-desc" />,
  );
}

describe("documents table", () => {
  it("tints only the rows whose status asks something of the reader", () => {
    const markup = render([
      row({ id: "a", status: "READY" }),
      row({ id: "b", status: "NEEDS_REVIEW" }),
      row({ id: "c", status: "FAILED" }),
      row({ id: "d", status: "PROCESSING" }),
    ]);

    expect(markup.match(/doc-row is-attention/g)).toHaveLength(1);
    expect(markup.match(/doc-row is-failed/g)).toHaveLength(1);
    expect(markup.match(/doc-row is-processing/g)).toHaveLength(1);
  });

  it("marks money cells numeric so totals scan as a column", () => {
    expect(render([row({})]).match(/is-numeric/g)).toHaveLength(2);
  });

  it("makes the whole row one link to the document", () => {
    const markup = render([row({ id: "abc" })]);

    expect(markup).toContain('class="doc-row__link" href="/documents/abc"');
    expect(markup.match(/href="\/documents\/abc"/g)).toHaveLength(1);
  });

  it("offers a checkbox per row plus one for the page", () => {
    const markup = render([row({ id: "a" }), row({ id: "b" })]);

    expect(markup.match(/type="checkbox"/g)).toHaveLength(3);
    expect(markup).toContain("Select all documents on this page");
  });

  it("says so rather than showing an empty table", () => {
    expect(render([])).toContain("No documents match these filters.");
  });
});

describe("column sorting", () => {
  it("starts money and dates on the reading people want first", () => {
    expect(nextSort("date", "supplier-asc")).toBe("date-desc");
    expect(nextSort("total", "date-desc")).toBe("total-desc");
    expect(nextSort("supplier", "date-desc")).toBe("supplier-asc");
  });

  it("flips direction when the column is already the sort", () => {
    expect(nextSort("date", "date-desc")).toBe("date-asc");
    expect(nextSort("date", "date-asc")).toBe("date-desc");
  });
});
