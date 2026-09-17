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

import { DocumentsEmpty } from "../src/components/documents/documents-empty";
import {
  DocumentsTable,
  nextSort,
} from "../src/components/documents/documents-table";
import type { DocumentListRow } from "../src/server/documents/documents-query-repository";

function row(overrides: Partial<DocumentListRow>): DocumentListRow {
  return {
    categoryName: "Software",
    currency: "ILS",
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
    expect(markup).toContain("בחירת כל המסמכים בעמוד");
  });

  it("makes the whole select cell the checkbox's hit area", () => {
    const markup = render([row({ id: "a" })]);

    expect(markup.match(/<label class="doc-row__select">/g)).toHaveLength(2);
  });

  it("offers the row's own verbs without opening the document", () => {
    const markup = render([row({ id: "a", supplierName: "Acme" })]);

    expect(markup).toContain("סימון Acme כנבדק");
    expect(markup).toContain("העברת Acme לארכיון");
  });

  it("leaves an unread supplier as an em dash", () => {
    expect(render([row({ supplierName: null })])).toContain(
      '<a class="doc-row__link" href="/documents/doc-1">—</a>',
    );
  });

  it("names the currency only when it is not the ledger's own", () => {
    expect(render([row({ currency: "ILS", total: "1200" })])).toContain(
      "1,200.00",
    );
    expect(render([row({ currency: "USD", total: "1200" })])).toContain(
      "$ 1,200.00",
    );
  });
});

describe("empty state", () => {
  it("offers a way out of the filters, not an uploader", () => {
    const markup = renderToStaticMarkup(<DocumentsEmpty isFiltered />);

    expect(markup).toContain("אין מסמכים שמתאימים לסינון");
    expect(markup).toContain("ניקוי הסינון");
  });

  it("invites a first upload when nothing is filtered", () => {
    const markup = renderToStaticMarkup(<DocumentsEmpty isFiltered={false} />);

    expect(markup).toContain("אין מסמכים עדיין");
    expect(markup).toContain('href="/upload"');
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
