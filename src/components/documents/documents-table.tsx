import Link from "next/link";

import type { DocumentListRow } from "../../server/documents/documents-query-repository";
import { formatDate, formatMoney, humanizeEnumValue } from "../../lib/format";

const statusVariant: Record<string, string> = {
  ARCHIVED: "neutral",
  FAILED: "error",
  NEEDS_REVIEW: "warning",
  PROCESSING: "neutral",
  READY: "success",
  UPLOADED: "neutral",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge status-badge--${statusVariant[status] ?? "neutral"}`}>
      {humanizeEnumValue(status)}
    </span>
  );
}

function Preview({ mimeType }: { mimeType: string | null }) {
  const label = mimeType?.startsWith("image/") ? "Image" : mimeType === "application/pdf" ? "PDF" : "File";
  return <span className="document-preview-chip">{label}</span>;
}

export function DocumentsTable({ rows }: { rows: DocumentListRow[] }) {
  if (rows.length === 0) {
    return <p className="content-state">No documents match these filters.</p>;
  }

  return (
    <>
      <table className="data-table documents-table--desktop">
        <thead>
          <tr>
            <th>Preview</th>
            <th>Date</th>
            <th>Supplier</th>
            <th>Type</th>
            <th>Category</th>
            <th>Total</th>
            <th>VAT</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/documents/${row.id}`}>
                  <Preview mimeType={row.mimeType} />
                </Link>
              </td>
              <td>{formatDate(row.transactionDate)}</td>
              <td>
                <Link href={`/documents/${row.id}`}>{row.supplierName ?? "—"}</Link>
              </td>
              <td>{humanizeEnumValue(row.type)}</td>
              <td>{row.categoryName ?? "—"}</td>
              <td>{formatMoney(row.total, null)}</td>
              <td>{formatMoney(row.vat, null)}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="data-list documents-table--mobile">
        {rows.map((row) => (
          <li className="data-list__item" key={row.id}>
            <Link className="data-list__item-link" href={`/documents/${row.id}`}>
              <div className="data-list__item-header">
                <Preview mimeType={row.mimeType} />
                <StatusBadge status={row.status} />
              </div>
              <div className="data-list__item-title">{row.supplierName ?? "Unknown supplier"}</div>
              <div className="data-list__item-meta">
                {formatDate(row.transactionDate)} · {humanizeEnumValue(row.type)}
                {row.categoryName ? ` · ${row.categoryName}` : ""}
              </div>
              <div className="data-list__item-meta">
                Total {formatMoney(row.total, null)} · VAT {formatMoney(row.vat, null)}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
