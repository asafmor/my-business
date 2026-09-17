"use client";

import {
  Archive,
  ArchiveRestore,
  CircleCheck,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  archiveDocumentAction,
  markReviewedAction,
  reprocessDocumentAction,
  unarchiveDocumentAction,
} from "../../app/(protected)/documents/[id]/actions";
import type { DocumentStatus } from "../../domain/documents/types";

type Verb = "archive" | "reprocess" | "restore" | "review";

/**
 * The document's verbs. One primary per status - the thing the reader most
 * likely came to do - and the rest quiet beside it. Archive is the only one
 * that asks first, because it is the only one that takes the document away.
 */
export function DocumentActions({
  documentId,
  name,
  reviewed,
  status,
}: {
  documentId: string;
  name: string;
  reviewed: boolean;
  status: DocumentStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<Verb | null>(null);
  const [confirming, setConfirming] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (confirming) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [confirming]);

  function run(verb: Verb, action: (id: string) => Promise<void>) {
    setRunning(verb);
    startTransition(async () => {
      try {
        await action(documentId);
      } finally {
        setRunning(null);
      }
    });
  }

  const busy = pending;
  const archived = status === "ARCHIVED";
  const reading = status === "UPLOADED" || status === "PROCESSING";
  const primary = archived
    ? "restore"
    : status === "NEEDS_REVIEW"
      ? "review"
      : status === "FAILED"
        ? "reprocess"
        : null;
  const buttonClass = (verb: Verb) =>
    `button ${primary === verb ? "button--primary" : "button--secondary"}`;
  const spinner = (
    <LoaderCircle
      aria-hidden
      className="button__spinner"
      size={14}
      strokeWidth={2}
    />
  );

  return (
    <div aria-label="פעולות על המסמך" className="record-actions" role="group">
      {archived ? (
        <button
          className={buttonClass("restore")}
          disabled={busy}
          onClick={() => run("restore", unarchiveDocumentAction)}
          type="button"
        >
          {running === "restore" ? (
            spinner
          ) : (
            <ArchiveRestore aria-hidden size={14} strokeWidth={2} />
          )}
          {running === "restore" ? "משחזר…" : "שחזור"}
        </button>
      ) : (
        <>
          {!reading && (status === "NEEDS_REVIEW" || !reviewed) ? (
            <button
              className={buttonClass("review")}
              disabled={busy}
              onClick={() => run("review", markReviewedAction)}
              type="button"
            >
              {running === "review" ? (
                spinner
              ) : (
                <CircleCheck aria-hidden size={14} strokeWidth={2} />
              )}
              {running === "review" ? "מסמן כנבדק…" : "סימון כנבדק"}
            </button>
          ) : null}
          <button
            className={buttonClass("reprocess")}
            disabled={busy || reading}
            onClick={() => run("reprocess", reprocessDocumentAction)}
            type="button"
          >
            {running === "reprocess" ? (
              spinner
            ) : (
              <RefreshCw aria-hidden size={14} strokeWidth={2} />
            )}
            {running === "reprocess" ? "מכניס לתור…" : "קריאה מחדש"}
          </button>
          <button
            className="button button--ghost record-actions__archive"
            disabled={busy}
            onClick={() => setConfirming(true)}
            type="button"
          >
            {running === "archive" ? (
              spinner
            ) : (
              <Archive aria-hidden size={14} strokeWidth={1.9} />
            )}
            {running === "archive" ? "מעביר לארכיון…" : "העברה לארכיון"}
          </button>
        </>
      )}

      <dialog
        aria-labelledby="archive-dialog-title"
        className="confirm-dialog"
        onCancel={() => setConfirming(false)}
        onClose={() => setConfirming(false)}
        ref={dialogRef}
      >
        <h2 id="archive-dialog-title">להעביר את “{name}” לארכיון?</h2>
        <p>המסמך יוסר מהרשימה ומהדוחות. הקובץ נשמר וניתן לשחזר אותו.</p>
        <div className="confirm-dialog__actions">
          <button
            className="button button--secondary"
            onClick={() => setConfirming(false)}
            type="button"
          >
            ביטול
          </button>
          <button
            className="button button--danger"
            onClick={() => {
              setConfirming(false);
              run("archive", archiveDocumentAction);
            }}
            type="button"
          >
            <Archive aria-hidden size={14} strokeWidth={2} />
            העברה לארכיון
          </button>
        </div>
      </dialog>
    </div>
  );
}
