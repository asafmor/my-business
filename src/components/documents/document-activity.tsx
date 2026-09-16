import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  CircleCheck,
  FileText,
  Pencil,
  Sparkles,
  Tags,
  TriangleAlert,
  Upload,
  type LucideIcon,
} from "lucide-react";

import {
  describeAuditEvent,
  type AuditEntryKind,
} from "../../domain/documents/audit-change";
import type { AuditEvent } from "../../domain/documents/types";
import { LocalDateTime } from "../ui/local-date-time";

const icons: Record<AuditEntryKind, LucideIcon> = {
  archive: Archive,
  category: Tags,
  edit: Pencil,
  extraction: Sparkles,
  failure: TriangleAlert,
  report: FileText,
  review: CircleCheck,
  unarchive: ArchiveRestore,
  upload: Upload,
};

/**
 * The document's story, newest first: who did what, when, and what changed.
 * Every row is a verb with a time; field changes also show before and after.
 */
export function DocumentActivity({
  categoryNameById,
  events,
}: {
  categoryNameById: Record<string, string>;
  events: AuditEvent[];
}) {
  return (
    <section aria-labelledby="activity-title" className="detail-card">
      <header className="detail-card__header">
        <div>
          <h2 className="detail-card__title" id="activity-title">
            Activity
          </h2>
          <p className="detail-card__note">
            Everything that has happened to this document, newest first.
          </p>
        </div>
        {events.length > 0 ? (
          <span className="count-pill num">{events.length}</span>
        ) : null}
      </header>

      {events.length === 0 ? (
        <p className="detail-card__empty">Nothing has happened yet.</p>
      ) : (
        <ol className="activity">
          {events.map((event) => {
            const entry = describeAuditEvent(event, categoryNameById);
            const Icon = icons[entry.kind];
            return (
              <li
                className={`activity__item activity__item--${entry.tone}`}
                key={event.id}
              >
                <span aria-hidden="true" className="activity__tile">
                  <Icon size={13} strokeWidth={1.9} />
                </span>
                <div className="activity__body">
                  <div className="activity__head">
                    <span className="activity__title">{entry.title}</span>
                    <span
                      className={`activity__source activity__source--${entry.source.toLowerCase()}`}
                    >
                      {entry.source}
                    </span>
                  </div>
                  {entry.before !== null && entry.after !== null ? (
                    <div className="activity__change">
                      <span className="activity__before">{entry.before}</span>
                      <ArrowRight aria-hidden size={11} strokeWidth={2} />
                      <span className="activity__after">{entry.after}</span>
                    </div>
                  ) : null}
                  {entry.detail ? (
                    <p className="activity__detail">{entry.detail}</p>
                  ) : null}
                </div>
                <LocalDateTime
                  className="activity__time"
                  value={event.createdAt}
                />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
