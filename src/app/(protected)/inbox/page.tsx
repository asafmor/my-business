import Link from "next/link";
import type { ReactNode } from "react";

import {
  markReviewedAction,
  reprocessDocumentAction,
  saveDocumentEditAction,
} from "../documents/[id]/actions";
import { InboxInlineEditForm } from "../../../components/inbox/inline-edit-form";
import { ProcessingLiveStatus } from "../../../components/inbox/processing-live-status";
import { attentionReasons } from "../../../domain/documents/attention-reasons";
import {
  formatDate,
  formatMoney,
  humanizeEnumValue,
} from "../../../lib/format";
import { DrizzleDocumentsQueryRepository } from "../../../server/documents/documents-query-repository";
import {
  DrizzleInboxQueryRepository,
  type InboxRow,
} from "../../../server/documents/inbox-query-repository";
import { requireSession } from "../../../server/auth/service";
import { statusTone } from "../../../domain/documents/status-tone";

const inboxRepository = new DrizzleInboxQueryRepository();
const documentsRepository = new DrizzleDocumentsQueryRepository();

type CardSection =
  "failed" | "needsReview" | "processing" | "recentlyCompleted";

function InboxCard({
  categories,
  row,
  section,
}: {
  categories: { id: string; name: string }[];
  row: InboxRow;
  section: CardSection;
}) {
  const reasons = attentionReasons(row);

  return (
    <li className="data-list__item inbox-card">
      <div className="data-list__item-header">
        <span
          className={`status-badge status-badge--${statusTone(row.status)}`}
        >
          {humanizeEnumValue(row.status)}
        </span>
        <Link href={`/documents/${row.id}`}>Open</Link>
      </div>
      <div className="data-list__item-title">
        {row.supplierName ?? "Unknown supplier"}
      </div>
      <div className="data-list__item-meta">
        {formatDate(row.transactionDate)} ·{" "}
        {formatMoney(row.total, row.currency)}
        {row.categoryName ? ` · ${row.categoryName}` : ""}
      </div>

      {reasons.length > 0 && (
        <ul className="inbox-card__reasons">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      <div className="inbox-card__actions">
        {section === "needsReview" && (
          <form action={markReviewedAction.bind(null, row.id)}>
            <button className="button button--secondary" type="submit">
              Approve
            </button>
          </form>
        )}
        {section === "failed" && (
          <form action={reprocessDocumentAction.bind(null, row.id)}>
            <button className="button button--secondary" type="submit">
              Retry processing
            </button>
          </form>
        )}
        {(section === "needsReview" || section === "failed") && (
          <InboxInlineEditForm
            action={saveDocumentEditAction.bind(null, row.id)}
            categories={categories}
            row={row}
          />
        )}
      </div>
    </li>
  );
}

function InboxSection({
  emptyText,
  renderRow,
  rows,
  title,
}: {
  emptyText: string;
  renderRow: (row: InboxRow) => ReactNode;
  rows: InboxRow[];
  title: string;
}) {
  return (
    <section className="inbox-section">
      <h2>
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="content-state">{emptyText}</p>
      ) : (
        <ul className="data-list">{rows.map(renderRow)}</ul>
      )}
    </section>
  );
}

export default async function InboxPage() {
  await requireSession();

  const [inbox, categories] = await Promise.all([
    inboxRepository.list(),
    documentsRepository.listActiveCategories(),
  ]);

  return (
    <div className="page">
      <h1 className="page-heading">Inbox</h1>

      <ProcessingLiveStatus
        documentIds={inbox.processing.map((row) => row.id)}
      />

      <InboxSection
        emptyText="Nothing needs review right now."
        renderRow={(row) => (
          <InboxCard
            categories={categories}
            key={row.id}
            row={row}
            section="needsReview"
          />
        )}
        rows={inbox.needsReview}
        title="Needs review"
      />

      <InboxSection
        emptyText="Nothing is processing right now."
        renderRow={(row) => (
          <InboxCard
            categories={categories}
            key={row.id}
            row={row}
            section="processing"
          />
        )}
        rows={inbox.processing}
        title="Processing"
      />

      <InboxSection
        emptyText="No failed documents."
        renderRow={(row) => (
          <InboxCard
            categories={categories}
            key={row.id}
            row={row}
            section="failed"
          />
        )}
        rows={inbox.failed}
        title="Failed"
      />

      <InboxSection
        emptyText="No recently completed documents."
        renderRow={(row) => (
          <InboxCard
            categories={categories}
            key={row.id}
            row={row}
            section="recentlyCompleted"
          />
        )}
        rows={inbox.recentlyCompleted}
        title="Recently completed"
      />
    </div>
  );
}
