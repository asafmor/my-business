import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DocumentsTable } from "../src/components/documents/documents-table";
import type { DocumentListRow } from "../src/server/documents/documents-query-repository";

function row(overrides: Partial<DocumentListRow>): DocumentListRow {
  return {
    categoryName: "Software",
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

describe("documents table", () => {
  it("tints only the rows whose status asks something of the reader", () => {
    const markup = renderToStaticMarkup(
      <DocumentsTable
        rows={[
          row({ id: "a", status: "READY" }),
          row({ id: "b", status: "NEEDS_REVIEW" }),
          row({ id: "c", status: "FAILED" }),
          row({ id: "d", status: "PROCESSING" }),
        ]}
      />,
    );

    expect(markup.match(/class="is-attention"/g)).toHaveLength(1);
    expect(markup.match(/class="is-failed"/g)).toHaveLength(1);
    expect(markup.match(/class="is-processing"/g)).toHaveLength(1);
    expect(markup).toContain("<tr><td>");
  });

  it("marks money cells numeric so totals scan as a column", () => {
    const markup = renderToStaticMarkup(<DocumentsTable rows={[row({})]} />);

    expect(markup.match(/class="is-numeric"/g)).toHaveLength(4);
  });
});
