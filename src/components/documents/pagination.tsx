"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { documentListPageSizes } from "../../domain/documents/query";
import { formatMoney, locale } from "../../lib/format";
import type { CurrencyTotal } from "../../server/documents/documents-query-repository";
import { useDocumentParams } from "./use-document-params";

const counter = new Intl.NumberFormat(locale);

function Totals({ label, totals }: { label: string; totals: CurrencyTotal[] }) {
  if (totals.length === 0) return null;
  return (
    <>
      <span className="table-foot__label">{label}</span>
      {totals.map((entry) => (
        <span className="num table-foot__sum" key={entry.currency}>
          {formatMoney(entry.total, entry.currency)}
        </span>
      ))}
      <span aria-hidden="true" className="table-foot__divider" />
    </>
  );
}

function sameTotals(a: CurrencyTotal[], b: CurrencyTotal[]): boolean {
  return (
    a.length === b.length &&
    a.every((entry, index) => {
      const other = b[index];
      return (
        other !== undefined &&
        other.currency === entry.currency &&
        Number(other.total) === Number(entry.total)
      );
    })
  );
}

export function Pagination({
  matchedTotals,
  page,
  pageSize,
  pageTotals,
  rowCount,
  total,
}: {
  matchedTotals: CurrencyTotal[];
  page: number;
  pageSize: number;
  pageTotals: CurrencyTotal[];
  rowCount: number;
  total: number;
}) {
  const setParams = useDocumentParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = first === 0 ? 0 : first + rowCount - 1;
  // On a single page the two sums are the same number printed twice.
  const showMatched = !sameTotals(pageTotals, matchedTotals);

  return (
    <nav aria-label="דפדוף" className="table-foot">
      <span className="num table-foot__range" dir="ltr">
        {counter.format(first)}–{counter.format(last)} מתוך{" "}
        {counter.format(total)}
      </span>
      <span aria-hidden="true" className="table-foot__divider" />
      <label className="table-foot__rows">
        שורות
        <select
          aria-label="שורות בעמוד"
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

      <Totals label={showMatched ? 'סה"כ בעמוד' : 'סה"כ'} totals={pageTotals} />
      {showMatched ? (
        <Totals label="כל התוצאות" totals={matchedTotals} />
      ) : null}

      {/* Right-to-left: "previous" points right, "next" points left. */}
      <button
        aria-label="העמוד הקודם"
        className="table-foot__step"
        disabled={page <= 1}
        onClick={() => setParams({ page: String(page - 1) })}
        type="button"
      >
        <ChevronRight aria-hidden size={12} strokeWidth={2.2} />
      </button>
      <span className="num table-foot__page" dir="ltr">
        {page} / {totalPages}
      </span>
      <button
        aria-label="העמוד הבא"
        className="table-foot__step"
        disabled={page >= totalPages}
        onClick={() => setParams({ page: String(page + 1) })}
        type="button"
      >
        <ChevronLeft aria-hidden size={12} strokeWidth={2.2} />
      </button>
    </nav>
  );
}
