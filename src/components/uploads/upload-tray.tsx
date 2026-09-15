"use client";

import Link from "next/link";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";

import {
  matchesFilter,
  useUploadTray,
  type TrayFilter,
  type TrayItem,
  type TrayStatus,
} from "./upload-tray-provider";

const statusLabels: Record<TrayStatus, string> = {
  complete: "Uploaded",
  duplicate: "Possible duplicate",
  failed: "Upload failed",
  "needs-review": "Needs review",
  processing: "Processing",
  "processing-failed": "Processing failed",
  queued: "Ready to upload",
  rejected: "Not accepted",
  uploading: "Uploading",
};

type IconTone = "danger" | "neutral" | "success" | "warning";

const iconTones: Record<TrayStatus, IconTone> = {
  complete: "success",
  duplicate: "warning",
  failed: "danger",
  "needs-review": "warning",
  processing: "neutral",
  "processing-failed": "danger",
  queued: "neutral",
  rejected: "danger",
  uploading: "neutral",
};

const inFlightStatuses: readonly TrayStatus[] = [
  "queued",
  "uploading",
  "processing",
];

function TrayStatusIcon({ status }: { status: TrayStatus }) {
  const tone = iconTones[status];

  if (inFlightStatuses.includes(status)) {
    return (
      <span
        aria-hidden="true"
        className="upload-tray-item__icon upload-tray-item__icon--spin"
      >
        <svg fill="none" height={16} viewBox="0 0 24 24" width={16}>
          <circle
            cx="12"
            cy="12"
            opacity="0.25"
            r="9"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`upload-tray-item__icon upload-tray-item__icon--${tone}`}
    >
      <svg fill="none" height={16} viewBox="0 0 24 24" width={16}>
        {tone === "success" ? (
          <path
            d="m5 13 4 4 10-10"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
        ) : tone === "warning" ? (
          <path
            d="M12 9v4m0 3.5h.01M10.9 4.6 2.7 18a1.5 1.5 0 0 0 1.3 2.25h16a1.5 1.5 0 0 0 1.3-2.25l-8.2-13.4a1.5 1.5 0 0 0-2.6 0Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        ) : (
          <path
            d="m7 7 10 10M17 7 7 17"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
        )}
      </svg>
    </span>
  );
}

const filters: { label: string; value: TrayFilter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Needs review", value: "review" },
  { label: "Failed", value: "failed" },
];

const removableStatuses: readonly TrayStatus[] = [
  "duplicate",
  "failed",
  "rejected",
];

function TrayItemRow({ item }: { item: TrayItem }) {
  const { allowDuplicateUpload, removeItem, retryProcessing, retryUpload } =
    useUploadTray();

  return (
    <li className="upload-tray-item">
      <TrayStatusIcon status={item.status} />
      <div className="upload-tray-item__body">
        <div className="upload-tray-item__row">
          <span className="upload-tray-item__name">{item.name}</span>
          {item.status === "needs-review" && item.documentId ? (
            <Link
              className="upload-tray-item__action"
              href={`/documents/${item.documentId}`}
            >
              Open
            </Link>
          ) : null}
          {item.status === "duplicate" ? (
            <button
              className="upload-tray-item__action"
              onClick={() => allowDuplicateUpload(item)}
              type="button"
            >
              Upload anyway
            </button>
          ) : null}
          {item.status === "failed" ? (
            <button
              className="upload-tray-item__action"
              onClick={() => retryUpload(item)}
              type="button"
            >
              Retry
            </button>
          ) : null}
          {item.status === "processing-failed" ? (
            <button
              className="upload-tray-item__action"
              onClick={() => retryProcessing(item)}
              type="button"
            >
              Retry
            </button>
          ) : null}
          {removableStatuses.includes(item.status) ? (
            <button
              aria-label={`Remove ${item.name}`}
              className="upload-tray-item__dismiss"
              onClick={() => removeItem(item.id)}
              type="button"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height={12}
                viewBox="0 0 24 24"
                width={12}
              >
                <path
                  d="m6 6 12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2.5"
                />
              </svg>
            </button>
          ) : null}
        </div>
        <p className="upload-tray-item__status">
          {statusLabels[item.status]}
          {item.meta ? ` · ${item.meta}` : ""}
        </p>
        {item.status === "uploading" ? (
          <span className="upload-tray-item__progress">
            <span
              className="upload-tray-item__progress-fill"
              style={{ width: `${item.progress ?? 0}%` }}
            />
          </span>
        ) : null}
        {item.message ? (
          <p className="upload-tray-item__message">{item.message}</p>
        ) : null}
        {item.reasons && item.reasons.length > 0 ? (
          <ul className="upload-tray-item__reasons">
            {item.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

const dragCollapseThresholdPx = 60;

function summaryTone(counts: {
  active: number;
  all: number;
  failed: number;
  review: number;
}): IconTone {
  if (counts.failed > 0) return "danger";
  if (counts.review > 0) return "warning";
  if (counts.active > 0) return "neutral";
  return "success";
}

function summaryText(counts: {
  active: number;
  all: number;
  failed: number;
  review: number;
}): string {
  if (counts.failed > 0) return `${counts.failed} failed`;
  if (counts.review > 0) return `${counts.review} need review`;
  if (counts.active > 0)
    return `Uploading ${counts.active} item${counts.active === 1 ? "" : "s"}`;
  return counts.all > 0 ? "All caught up" : "No uploads yet";
}

export function UploadTray() {
  const { counts, dismiss, filter, items, setFilter, toggleSize, view } =
    useUploadTray();
  const dragStartY = useRef<number | null>(null);

  if (view === "dismissed") return null;

  const visibleItems = items.filter((item) => matchesFilter(item, filter));

  function handleHandlePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ): void {
    dragStartY.current = event.clientY;
  }

  function handleHandlePointerUp(
    event: ReactPointerEvent<HTMLDivElement>,
  ): void {
    if (dragStartY.current === null) return;
    const delta = event.clientY - dragStartY.current;
    dragStartY.current = null;
    if (Math.abs(delta) < dragCollapseThresholdPx) return;
    if (delta > 0 && view === "expanded") toggleSize();
    if (delta < 0 && view === "minimized") toggleSize();
  }

  if (view === "minimized") {
    return (
      <section
        aria-label="Upload tray"
        className="upload-tray upload-tray--minimized"
      >
        <div
          className="upload-tray__handle"
          onPointerDown={handleHandlePointerDown}
          onPointerUp={handleHandlePointerUp}
        >
          <span className="upload-tray__handle-grip" aria-hidden="true" />
        </div>
        <button
          className={`upload-tray-summary upload-tray-summary--${summaryTone(counts)}`}
          onClick={toggleSize}
          type="button"
        >
          <TrayStatusIcon
            status={
              counts.failed > 0
                ? "failed"
                : counts.review > 0
                  ? "needs-review"
                  : counts.active > 0
                    ? "processing"
                    : "complete"
            }
          />
          <span className="upload-tray-summary__text">
            {summaryText(counts)}
          </span>
          <span
            aria-label="Dismiss upload tray"
            className="upload-tray-summary__dismiss"
            onClick={(event) => {
              event.stopPropagation();
              dismiss();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
                event.preventDefault();
                dismiss();
              }
            }}
            role="button"
            tabIndex={0}
          >
            <svg
              aria-hidden="true"
              fill="none"
              height={14}
              viewBox="0 0 24 24"
              width={14}
            >
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2.5"
              />
            </svg>
          </span>
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="Upload tray"
      className="upload-tray upload-tray--expanded"
    >
      <div
        className="upload-tray__handle"
        onPointerDown={handleHandlePointerDown}
        onPointerUp={handleHandlePointerUp}
      >
        <button
          aria-expanded
          className="upload-tray__handle-button"
          onClick={toggleSize}
          type="button"
        >
          <span className="upload-tray__handle-grip" aria-hidden="true" />
        </button>
      </div>
      <div className="upload-tray__header">
        <h2>Uploads</h2>
        <div className="upload-tray__header-actions">
          <button
            aria-label="Minimize"
            className="icon-button upload-tray__chevron"
            onClick={toggleSize}
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height={16}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
              width={16}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <button
            aria-label="Dismiss upload tray"
            className="icon-button"
            onClick={dismiss}
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height={16}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
              width={16}
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </div>
      <div
        className="upload-tray__filters"
        role="group"
        aria-label="Filter uploads"
      >
        {filters.map((entry) => (
          <button
            aria-pressed={filter === entry.value}
            className={filter === entry.value ? "chip chip--selected" : "chip"}
            key={entry.value}
            onClick={() => setFilter(entry.value)}
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </div>
      <ul className="upload-tray__list" aria-live="polite">
        {visibleItems.length === 0 ? (
          <li className="upload-tray__empty">Nothing matches this filter.</li>
        ) : (
          visibleItems.map((item) => <TrayItemRow item={item} key={item.id} />)
        )}
      </ul>
    </section>
  );
}
