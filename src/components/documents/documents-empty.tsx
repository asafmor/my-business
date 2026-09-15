"use client";

import { FileStack, SearchX, Upload, X } from "lucide-react";
import Link from "next/link";

import { clearedFilters } from "../../domain/documents/query";
import { useDocumentParams } from "./use-document-params";

/**
 * Two different nothings. An empty shelf is an invitation to put something on
 * it; an empty result is a filter that went too far, and the way out is the
 * filter, not the uploader.
 */
export function DocumentsEmpty({ isFiltered }: { isFiltered: boolean }) {
  const setParams = useDocumentParams();

  if (!isFiltered) {
    return (
      <div className="empty-state">
        <span aria-hidden="true" className="empty-state__tile">
          <FileStack size={20} strokeWidth={1.5} />
        </span>
        <h2 className="empty-state__title">No documents yet</h2>
        <p className="empty-state__body">
          Drop in a receipt or an invoice. It is read, filed and left here for
          you to confirm.
        </p>
        <Link className="button button--primary" href="/upload">
          <Upload aria-hidden size={14} strokeWidth={2} />
          Upload a document
        </Link>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <span aria-hidden="true" className="empty-state__tile">
        <SearchX size={20} strokeWidth={1.5} />
      </span>
      <h2 className="empty-state__title">Nothing matches these filters</h2>
      <p className="empty-state__body">
        Every document is still here — this combination just has no rows in it.
      </p>
      <button
        className="button button--secondary"
        onClick={() => setParams(clearedFilters)}
        type="button"
      >
        <X aria-hidden size={14} strokeWidth={2} />
        Clear filters
      </button>
    </div>
  );
}
