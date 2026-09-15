import Link from "next/link";

import { ContentState } from "../../components/ui/content-state";
import { ProportionBars } from "../../components/charts/proportion-bars";
import { OpenTrayButton } from "../../components/uploads/open-tray-button";
import { attentionReasons } from "../../domain/documents/attention-reasons";
import { currentReportingMonth } from "../../domain/documents/dashboard";
import { formatDate, formatMoney, humanizeEnumValue } from "../../lib/format";
import { DrizzleDashboardRepository } from "../../server/documents/dashboard-repository";
import { DrizzleInboxQueryRepository } from "../../server/documents/inbox-query-repository";
import { requireSession } from "../../server/auth/service";
import { statusTone } from "../../domain/documents/status-tone";

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

      <ul className="dashboard-stats">
        <Kpi
          label="Total expenses"
          value={formatMoney(summary.totalExpenses, null)}
        />
        <Kpi label="VAT" value={formatMoney(summary.vatTotal, null)} />
        <Kpi label="Documents" value={String(summary.documentCount)} />
        <Kpi
          label="Waiting for review"
          tone={summary.needsReviewCount > 0 ? "attention" : undefined}
          value={String(summary.needsReviewCount)}
        />
      </ul>

      <div className="dashboard-grid">
        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2>Needs attention</h2>
            <OpenTrayButton className="text-button">
              View all in tray
            </OpenTrayButton>
          </div>
          {needsAttention.length === 0 ? (
            <p className="content-state">Nothing needs review right now.</p>
          ) : (
            <ul className="data-list">
              {needsAttention.map((row) => (
                <li className="data-list__item is-attention" key={row.id}>
                  <Link
                    className="data-list__item-link"
                    href={`/documents/${row.id}`}
                  >
                    <div className="data-list__item-header">
                      <span className="data-list__item-title">
                        {row.supplierName ?? "Unknown supplier"}
                      </span>
                      <span className="num">
                        {formatMoney(row.total, row.currency)}
                      </span>
                    </div>
                    <div className="data-list__item-meta">
                      {formatDate(row.transactionDate)}
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
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2>Categories</h2>
            <span className="dashboard-section__note">this month</span>
          </div>
          <ProportionBars
            empty="No expenses recorded this month."
            rows={categoryBreakdown.map((row) => ({
              label: row.categoryName ?? "Uncategorized",
              value: row.total,
            }))}
          />
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2>Recently uploaded</h2>
          </div>
          <RecentDocumentsList rows={recentlyUploaded} />
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2>Recently edited</h2>
          </div>
          <RecentDocumentsList rows={recentlyEdited} />
        </section>
      </div>

      <div className="dashboard-quick-actions">
        <OpenTrayButton className="button button--secondary">
          Open tray
        </OpenTrayButton>
        <Link className="button button--secondary" href="/reports">
          Monthly report
        </Link>
      </div>
    </div>
  );
}

function Kpi({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "attention";
  value: string;
}) {
  return (
    <li
      className={
        tone ? `dashboard-stat dashboard-stat--${tone}` : "dashboard-stat"
      }
    >
      <span className="dashboard-stat__label">{label}</span>
      <span className="dashboard-stat__value num">{value}</span>
    </li>
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
              <span className="data-list__item-title">
                {row.supplierName ?? "Unknown supplier"}
              </span>
              <span
                className={`status-badge status-badge--${statusTone(row.status)}`}
              >
                {humanizeEnumValue(row.status)}
              </span>
            </div>
            <div className="data-list__item-meta">{formatDate(row.at)}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
