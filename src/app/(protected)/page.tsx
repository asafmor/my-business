import Link from "next/link";

import { ContentState } from "../../components/ui/content-state";
import { attentionReasons } from "../../domain/documents/attention-reasons";
import { currentReportingMonth } from "../../domain/documents/dashboard";
import { formatDate, formatMoney, humanizeEnumValue } from "../../lib/format";
import { DrizzleDashboardRepository } from "../../server/documents/dashboard-repository";
import { DrizzleInboxQueryRepository } from "../../server/documents/inbox-query-repository";
import { requireSession } from "../../server/auth/service";

export const dynamic = "force-dynamic";

const dashboardRepository = new DrizzleDashboardRepository();
const inboxRepository = new DrizzleInboxQueryRepository();

const needsAttentionLimit = 5;
const recentDocumentsLimit = 5;

export default async function DashboardPage() {
  await requireSession();

  const hasAnyDocuments = await dashboardRepository.hasAnyDocuments();

  if (!hasAnyDocuments) {
    return (
      <>
        <header className="page-heading">
          <h1>Dashboard</h1>
        </header>
        <ContentState
          action={
            <Link className="button button--primary" href="/upload">
              Upload your first document
            </Link>
          }
          description="Upload a receipt or invoice to start tracking expenses."
          title="No documents yet"
        />
      </>
    );
  }

  const month = currentReportingMonth();
  const [summary, categoryBreakdown, recentlyUploaded, recentlyEdited, inbox] =
    await Promise.all([
      dashboardRepository.summary(month),
      dashboardRepository.categoryBreakdown(month),
      dashboardRepository.recentlyUploaded(recentDocumentsLimit),
      dashboardRepository.recentlyEdited(recentDocumentsLimit),
      inboxRepository.list(),
    ]);
  const needsAttention = inbox.needsReview.slice(0, needsAttentionLimit);

  return (
    <div className="page">
      <header className="page-heading">
        <h1>Dashboard</h1>
        <p>What is the current state of your bookkeeping?</p>
      </header>

      <section className="dashboard-section">
        <h2>This month</h2>
        <ul className="dashboard-stats">
          <li className="dashboard-stat">
            <span className="dashboard-stat__value">
              {formatMoney(summary.totalExpenses, null)}
            </span>
            <span className="dashboard-stat__label">Total expenses</span>
          </li>
          <li className="dashboard-stat">
            <span className="dashboard-stat__value">{formatMoney(summary.vatTotal, null)}</span>
            <span className="dashboard-stat__label">VAT</span>
          </li>
          <li className="dashboard-stat">
            <span className="dashboard-stat__value">{summary.documentCount}</span>
            <span className="dashboard-stat__label">Documents</span>
          </li>
          <li className="dashboard-stat">
            <span className="dashboard-stat__value">{summary.needsReviewCount}</span>
            <span className="dashboard-stat__label">Waiting for review</span>
          </li>
        </ul>
      </section>

      <section className="dashboard-section">
        <h2>Needs attention</h2>
        {needsAttention.length === 0 ? (
          <p className="content-state">Nothing needs review right now.</p>
        ) : (
          <ul className="data-list">
            {needsAttention.map((row) => (
              <li className="data-list__item" key={row.id}>
                <Link className="data-list__item-link" href={`/documents/${row.id}`}>
                  <div className="data-list__item-title">
                    {row.supplierName ?? "Unknown supplier"}
                  </div>
                  <div className="data-list__item-meta">
                    {formatDate(row.transactionDate)} · {formatMoney(row.total, row.currency)}
                  </div>
                  <ul className="inbox-card__reasons">
                    {attentionReasons(row).map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/inbox">View all in Inbox</Link>
      </section>

      <section className="dashboard-section">
        <h2>Categories</h2>
        {categoryBreakdown.length === 0 ? (
          <p className="content-state">No expenses recorded this month.</p>
        ) : (
          <ul className="data-list">
            {categoryBreakdown.map((row) => (
              <li className="data-list__item" key={row.categoryName ?? "uncategorized"}>
                <div className="data-list__item-header">
                  <span>{row.categoryName ?? "Uncategorized"}</span>
                  <span>{formatMoney(row.total, null)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dashboard-section">
        <h2>Recently uploaded</h2>
        <RecentDocumentsList rows={recentlyUploaded} />
      </section>

      <section className="dashboard-section">
        <h2>Recently edited</h2>
        <RecentDocumentsList rows={recentlyEdited} />
      </section>

      <section className="dashboard-section">
        <h2>Quick actions</h2>
        <div className="dashboard-quick-actions">
          <Link className="button button--primary" href="/upload">
            Upload document
          </Link>
          <Link className="button button--secondary" href="/inbox">
            Open inbox
          </Link>
          <Link className="button button--secondary" href="/reports">
            Monthly report
          </Link>
        </div>
      </section>
    </div>
  );
}

function RecentDocumentsList({
  rows,
}: {
  rows: { at: Date; id: string; status: string; supplierName: string | null }[];
}) {
  if (rows.length === 0) {
    return <p className="content-state">No documents yet.</p>;
  }

  return (
    <ul className="data-list">
      {rows.map((row) => (
        <li className="data-list__item" key={row.id}>
          <Link className="data-list__item-link" href={`/documents/${row.id}`}>
            <div className="data-list__item-header">
              <span className="status-badge">{humanizeEnumValue(row.status)}</span>
            </div>
            <div className="data-list__item-title">{row.supplierName ?? "Unknown supplier"}</div>
            <div className="data-list__item-meta">{formatDate(row.at)}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
