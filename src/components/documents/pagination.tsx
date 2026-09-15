"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { documentListPageSizes } from "../../domain/documents/query";
import { useDocumentParams } from "./use-document-params";

const counter = new Intl.NumberFormat("en-US");

export function Pagination({
  matchedTotal,
  page,
  pageSize,
  pageTotal,
  rowCount,
  total,
}: {
  matchedTotal: string;
  page: number;
  pageSize: number;
  pageTotal: string;
  rowCount: number;
  total: number;
}) {
  const setParams = useDocumentParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = first === 0 ? 0 : first + rowCount - 1;

  return (
    <nav aria-label="Pagination" className="table-foot">
      <span className="num table-foot__range">
        {counter.format(first)}–{counter.format(last)} of{" "}
        {counter.format(total)}
      </span>
      <span aria-hidden="true" className="table-foot__divider" />
      <label className="table-foot__rows">
        Rows
        <select
          aria-label="Rows per page"
          className="table-foot__select"
          onChange={(event) =>
            setParams({ page: "1", pageSize: event.target.value })
          }
          value={pageSize}
        >
          {documentListPageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <span className="table-foot__spacer" />

      <span className="table-foot__label">Page total</span>
      <span className="num table-foot__sum">{pageTotal}</span>
      <span aria-hidden="true" className="table-foot__divider" />
      <span className="table-foot__label">All matches</span>
      <span className="num table-foot__sum">{matchedTotal}</span>
      <span aria-hidden="true" className="table-foot__divider" />

      <button
        aria-label="Previous page"
        className="table-foot__step"
        disabled={page <= 1}
        onClick={() => setParams({ page: String(page - 1) })}
        type="button"
      >
        <ChevronLeft aria-hidden size={12} strokeWidth={2.2} />
      </button>
      <span className="num table-foot__page">
        {page} / {totalPages}
      </span>
      <button
        aria-label="Next page"
        className="table-foot__step"
        disabled={page >= totalPages}
        onClick={() => setParams({ page: String(page + 1) })}
        type="button"
      >
        <ChevronRight aria-hidden size={12} strokeWidth={2.2} />
      </button>
    </nav>
  );
}
