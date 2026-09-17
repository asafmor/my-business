"use client";

import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Tags,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  archiveDocumentsAction,
  markDocumentsReviewedAction,
  setDocumentsCategoryAction,
  unarchiveDocumentsAction,
  type DocumentActionResult,
} from "../../app/(protected)/documents/actions";
import type {
  DocumentListSort,
  DocumentListSortColumn,
} from "../../domain/documents/query";
import { splitSort } from "../../domain/documents/query";
import { statusRowState, statusTone } from "../../domain/documents/status-tone";
import { defaultCurrency, formatDate, formatMoney } from "../../lib/format";
import {
  countOf,
  documentStatusLabel,
  documentTypeLabel,
} from "../../lib/labels";
import type { DocumentListRow } from "../../server/documents/documents-query-repository";
import { signalNavigationCancel } from "../layout/navigation-progress";
import { useDocumentParams } from "./use-document-params";

const columns: {
  align?: "end";
  key: DocumentListSortColumn;
  label: string;
}[] = [
  { key: "date", label: "תאריך" },
  { key: "type", label: "סוג" },
  { key: "category", label: "קטגוריה" },
  { align: "end", key: "vat", label: 'מע"מ' },
  { align: "end", key: "total", label: 'סה"כ' },
  { key: "status", label: "סטטוס" },
];

/** A new column starts on the reading most people want first. */
export function nextSort(
  column: DocumentListSortColumn,
  current: DocumentListSort,
): DocumentListSort {
  const active = splitSort(current);
  if (active.column !== column) {
    const descendingFirst = column === "date" || column === "total";
    return `${column}-${descendingFirst ? "desc" : "asc"}` as DocumentListSort;
  }
  return `${column}-${active.direction === "asc" ? "desc" : "asc"}` as DocumentListSort;
}

function TypeTile({ mimeType }: { mimeType: string | null }) {
  const Icon = mimeType?.startsWith("image/")
    ? ImageIcon
    : mimeType === "application/pdf"
      ? FileText
      : Paperclip;
  return (
    <span aria-hidden="true" className="doc-row__tile">
      <Icon size={13} strokeWidth={1.7} />
    </span>
  );
}

export function DocumentsTable({
  categories,
  rows,
  sort,
}: {
  categories: { id: string; name: string }[];
  rows: DocumentListRow[];
  sort: DocumentListSort;
}) {
  const router = useRouter();
  const setParams = useDocumentParams();
  const active = splitSort(sort);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"archive" | "categorize" | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);

  /* Archived rows only appear under the archived status filter, so a selection
     is either entirely archived or not archived at all. */
  const restorable =
    selected.length > 0 &&
    selected.every(
      (id) => rows.find((row) => row.id === id)?.status === "ARCHIVED",
    );

  /* A page of results is the selection's whole world: turn it, lose it. */
  useEffect(() => {
    setSelected((current) =>
      current.filter((id) => rows.some((row) => row.id === id)),
    );
  }, [rows]);

  useEffect(() => {
    if (dialog === null) dialogRef.current?.close();
    else dialogRef.current?.showModal();
  }, [dialog]);

  function run(action: () => Promise<DocumentActionResult>): void {
    startTransition(async () => {
      const result = await action();
      setError(result.error);
      if (result.error === null) setSelected([]);
      router.refresh();
    });
  }

  const allSelected = rows.length > 0 && selected.length === rows.length;

  function toggle(id: string): void {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((other) => other !== id)
        : [...current, id],
    );
  }

  const selectedCount = countOf(selected.length, "מסמך אחד", "מסמכים");

  return (
    <>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div
        aria-busy={isPending}
        aria-label="מסמכים"
        className="doc-table"
        role="table"
      >
        <div className="doc-row doc-row--head" role="row">
          {/* A label, not a span: the whole cell is the checkbox's hit area. */}
          <label className="doc-row__select">
            <input
              aria-label="בחירת כל המסמכים בעמוד"
              checked={allSelected}
              className="checkbox"
              onChange={() =>
                setSelected(allSelected ? [] : rows.map((row) => row.id))
              }
              type="checkbox"
            />
          </label>
          <button
            aria-sort={
              active.column === "supplier"
                ? `${active.direction}ending`
                : undefined
            }
            className="lbl doc-sort"
            onClick={() => setParams({ sort: nextSort("supplier", sort) })}
            type="button"
          >
            מסמך
            {active.column === "supplier" ? (
              active.direction === "asc" ? (
                <ChevronUp aria-hidden size={10} strokeWidth={3} />
              ) : (
                <ChevronDown aria-hidden size={10} strokeWidth={3} />
              )
            ) : null}
          </button>
          {columns.map((column) => (
            <button
              aria-sort={
                active.column === column.key
                  ? `${active.direction}ending`
                  : undefined
              }
              className={
                column.align === "end"
                  ? "lbl doc-sort doc-sort--end"
                  : "lbl doc-sort"
              }
              key={column.key}
              onClick={() => setParams({ sort: nextSort(column.key, sort) })}
              type="button"
            >
              {column.label}
              {active.column === column.key ? (
                active.direction === "asc" ? (
                  <ChevronUp aria-hidden size={10} strokeWidth={3} />
                ) : (
                  <ChevronDown aria-hidden size={10} strokeWidth={3} />
                )
              ) : null}
            </button>
          ))}
        </div>

        {rows.map((row) => {
          const isSelected = selected.includes(row.id);
          /* Rule 6: an unread supplier is an em dash, not a guess in prose. */
          const name = row.supplierName ?? "—";
          /* The ledger's own currency is implied; anything else is spelled out. */
          const foreign =
            row.currency !== null && row.currency !== defaultCurrency;

          return (
            <div
              className={`doc-row ${statusRowState(row.status) ?? ""}`.trim()}
              data-selected={isSelected ? "" : undefined}
              key={row.id}
              role="row"
            >
              <label className="doc-row__select">
                <input
                  aria-label={`בחירת ${name}`}
                  checked={isSelected}
                  className="checkbox"
                  onChange={() => toggle(row.id)}
                  type="checkbox"
                />
              </label>

              <span className="doc-row__doc">
                <TypeTile mimeType={row.mimeType} />
                <span className="doc-row__names">
                  {/* Stretched link: the anchor covers the row, so the whole
                      row opens the document while staying a real link. Once a
                      selection exists the row is a tick box instead — picking
                      the second of five should not walk off the page. */}
                  <Link
                    className="doc-row__link"
                    href={`/documents/${row.id}`}
                    onClick={(event) => {
                      if (selected.length === 0) return;
                      event.preventDefault();
                      signalNavigationCancel();
                      toggle(row.id);
                    }}
                  >
                    {name}
                  </Link>
                  <span className="doc-row__sub">
                    {row.documentNumber ?? "—"}
                  </span>
                </span>
              </span>

              <span className="cell num doc-row__date">
                {formatDate(row.transactionDate)}
              </span>
              <span className="cell doc-row__type">
                {documentTypeLabel(row.type)}
              </span>
              <span
                className={
                  row.categoryName
                    ? "cell doc-row__category"
                    : "cell doc-row__category is-empty"
                }
              >
                {row.categoryName ?? "—"}
              </span>
              <span className="cell num is-numeric doc-row__vat">
                {formatMoney(row.vat, null)}
              </span>
              <span className="cell num is-numeric doc-row__total">
                {formatMoney(row.total, foreign ? row.currency : null)}
              </span>
              <span className="doc-row__status">
                <span
                  className={`status-badge status-badge--${statusTone(row.status)}`}
                >
                  {documentStatusLabel(row.status)}
                </span>
              </span>

              {/* Quiet until touched: the row's own verbs appear on hover or
                  focus, above the stretched link so they stay clickable. */}
              <span className="doc-row__actions">
                <button
                  aria-label={`סימון ${name} כנבדק`}
                  className="doc-row__action"
                  disabled={isPending}
                  onClick={() =>
                    run(() => markDocumentsReviewedAction([row.id]))
                  }
                  title="סימון כנבדק"
                  type="button"
                >
                  <CircleCheck aria-hidden size={13} strokeWidth={1.9} />
                </button>
                {row.status === "ARCHIVED" ? (
                  /* Restoring is itself reversible, so it skips the dialog
                     that archiving needs. */
                  <button
                    aria-label={`שחזור ${name}`}
                    className="doc-row__action"
                    disabled={isPending}
                    onClick={() =>
                      run(() => unarchiveDocumentsAction([row.id]))
                    }
                    title="שחזור"
                    type="button"
                  >
                    <ArchiveRestore aria-hidden size={13} strokeWidth={1.9} />
                  </button>
                ) : (
                  <button
                    aria-label={`העברת ${name} לארכיון`}
                    className="doc-row__action doc-row__action--danger"
                    disabled={isPending}
                    onClick={() => {
                      setSelected([row.id]);
                      setDialog("archive");
                    }}
                    title="העברה לארכיון"
                    type="button"
                  >
                    <Archive aria-hidden size={13} strokeWidth={1.9} />
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {selected.length > 0 ? (
        <div aria-label="פעולות מרובות" className="selection-bar" role="group">
          <span className="selection-bar__count num">
            {selected.length} נבחרו
          </span>
          <span aria-hidden="true" className="selection-bar__divider" />
          <div className="selection-bar__actions">
            <button
              className="selection-bar__action"
              onClick={() => {
                setCategoryDraft(categories[0]?.id ?? "");
                setDialog("categorize");
              }}
              type="button"
            >
              <Tags aria-hidden size={14} strokeWidth={1.9} />
              <span>
                שיוך לקטגוריה
                <span className="selection-bar__scope"> לנבחרים</span>
              </span>
            </button>
            <button
              className="selection-bar__action"
              onClick={() => run(() => markDocumentsReviewedAction(selected))}
              type="button"
            >
              <CircleCheck aria-hidden size={14} strokeWidth={1.9} />
              <span>סימון כנבדק</span>
            </button>
            {restorable ? (
              <button
                className="selection-bar__action"
                onClick={() => run(() => unarchiveDocumentsAction(selected))}
                type="button"
              >
                <ArchiveRestore aria-hidden size={14} strokeWidth={1.9} />
                <span>
                  שחזור<span className="selection-bar__scope"> הנבחרים</span>
                </span>
              </button>
            ) : (
              <button
                className="selection-bar__action selection-bar__action--danger"
                onClick={() => setDialog("archive")}
                type="button"
              >
                <Archive aria-hidden size={14} strokeWidth={1.9} />
                <span>
                  לארכיון<span className="selection-bar__scope"> הנבחרים</span>
                </span>
              </button>
            )}
          </div>
          <button
            aria-label="ביטול הבחירה"
            className="selection-bar__dismiss"
            onClick={() => setSelected([])}
            type="button"
          >
            <X aria-hidden size={13} strokeWidth={2.4} />
          </button>
        </div>
      ) : null}

      <dialog
        aria-labelledby="documents-dialog-title"
        className="confirm-dialog"
        onCancel={() => setDialog(null)}
        onClose={() => setDialog(null)}
        ref={dialogRef}
      >
        {dialog === "archive" ? (
          <>
            <h2 id="documents-dialog-title">להעביר {selectedCount} לארכיון?</h2>
            <p>
              הם יוסרו מהרשימה ומהדוחות. הקבצים נשמרים וניתן לשחזר אותם דרך
              הסינון &quot;בארכיון&quot;.
            </p>
            <div className="confirm-dialog__actions">
              <button
                className="button button--secondary"
                onClick={() => setDialog(null)}
                type="button"
              >
                ביטול
              </button>
              <button
                className="button button--danger"
                onClick={() => {
                  const ids = selected;
                  setDialog(null);
                  run(() => archiveDocumentsAction(ids));
                }}
                type="button"
              >
                <Archive aria-hidden size={14} strokeWidth={2} />
                העברה לארכיון
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="documents-dialog-title">לתייק {selectedCount} תחת</h2>
            <div className="field">
              <label htmlFor="bulk-category">קטגוריה</label>
              <select
                className="form-control"
                id="bulk-category"
                onChange={(event) => setCategoryDraft(event.target.value)}
                value={categoryDraft}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="confirm-dialog__actions">
              <button
                className="button button--secondary"
                onClick={() => setDialog(null)}
                type="button"
              >
                ביטול
              </button>
              <button
                className="button button--primary"
                disabled={categoryDraft === ""}
                onClick={() => {
                  const ids = selected;
                  const categoryId = categoryDraft;
                  setDialog(null);
                  run(() => setDocumentsCategoryAction(ids, categoryId));
                }}
                type="button"
              >
                <Tags aria-hidden size={14} strokeWidth={2} />
                החלה
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
