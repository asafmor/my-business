import Link from "next/link";

import type { DocumentListRow } from "../../server/documents/documents-query-repository";
import { formatDate, formatMoney, humanizeEnumValue } from "../../lib/format";
import { statusRowState, statusTone } from "../../domain/documents/status-tone";

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge status-badge--${statusTone(status)}`}>
      {humanizeEnumValue(status)}
    </span>
  );
}

function Preview({ mimeType }: { mimeType: string | null }) {
  const label = mimeType?.startsWith("image/")
    ? "Image"
    : mimeType === "application/pdf"
      ? "PDF"
      : "File";
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
            <th className="is-numeric">Total</th>
            <th className="is-numeric">VAT</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className={statusRowState(row.status)} key={row.id}>
              <td>
                <Link href={`/documents/${row.id}`}>
                  <Preview mimeType={row.mimeType} />
                </Link>
              </td>
              <td>{formatDate(row.transactionDate)}</td>
              <td>
                <Link href={`/documents/${row.id}`}>
                  {row.supplierName ?? "—"}
                </Link>
              </td>
              <td>{humanizeEnumValue(row.type)}</td>
              <td>{row.categoryName ?? "—"}</td>
              <td className="is-numeric">{formatMoney(row.total, null)}</td>
              <td className="is-numeric">{formatMoney(row.vat, null)}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="data-list documents-table--mobile">
        {rows.map((row) => (
          <li
            className={`data-list__item ${statusRowState(row.status) ?? ""}`.trim()}
            key={row.id}
          >
            <Link
              className="data-list__item-link"
              href={`/documents/${row.id}`}
            >
              <div className="data-list__item-header">
                <Preview mimeType={row.mimeType} />
                <StatusBadge status={row.status} />
              </div>
              <div className="data-list__item-title">
                {row.supplierName ?? "Unknown supplier"}
              </div>
              <div className="data-list__item-meta">
                {formatDate(row.transactionDate)} ·{" "}
                {humanizeEnumValue(row.type)}
                {row.categoryName ? ` · ${row.categoryName}` : ""}
              </div>
              <div className="data-list__item-meta">
                Total{" "}
                <span className="num">{formatMoney(row.total, null)}</span> ·
                VAT <span className="num">{formatMoney(row.vat, null)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
