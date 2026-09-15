import Link from "next/link";

import { generateReportAction } from "./actions";
import { ProportionBars } from "../../../components/charts/proportion-bars";
import { attentionReasons } from "../../../domain/documents/attention-reasons";
import {
  parseReportMonth,
  shiftReportMonth,
} from "../../../domain/reports/month";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  humanizeEnumValue,
} from "../../../lib/format";
import { createPrivateReadUrl } from "../../../server/storage/private-access";
import { getR2ObjectStorage } from "../../../server/storage/object-storage";
import { parseObjectKey } from "../../../server/storage/object-keys";
import { DrizzleMonthlyReportRepository } from "../../../server/reports/monthly-report-repository";
import { DrizzleReportArtifactRepository } from "../../../server/reports/report-artifact-repository";
import { requireSession } from "../../../server/auth/service";
import { statusTone } from "../../../domain/documents/status-tone";

export const dynamic = "force-dynamic";

const repository = new DrizzleMonthlyReportRepository();
const artifactRepository = new DrizzleReportArtifactRepository();

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();

  const rawMonth = (await searchParams).month;
  const month = parseReportMonth(
    Array.isArray(rawMonth) ? rawMonth[0] : rawMonth,
  );
  const previousMonth = shiftReportMonth(month, -1);
  const nextMonth = shiftReportMonth(month, 1);

  const [
    summary,
    categoryBreakdown,
    supplierBreakdown,
    problematicDocuments,
    storedReports,
  ] = await Promise.all([
    repository.summary(month),
    repository.categoryBreakdown(month),
    repository.supplierBreakdown(month),
    repository.problematicDocuments(month),
    artifactRepository.listForMonth(month),
  ]);

  const storage = getR2ObjectStorage();
  const storedReportsWithLinks = await Promise.all(
    storedReports.map(async (report) => {
      const signed = await createPrivateReadUrl(storage, {
        authorize: () => {},
        key: parseObjectKey(report.objectKey),
      });
      return { ...report, downloadUrl: signed.url };
    }),
  );

  return (
    <div className="page">
      <header className="page-heading">
        <h1>Reports</h1>
        <p>Monthly summaries and exports.</p>
      </header>

      <nav aria-label="Reporting month" className="month-nav">
        <Link
          className="month-nav__step"
          href={`/reports?month=${previousMonth}`}
        >
          <span aria-hidden="true">&larr;</span> {previousMonth}
        </Link>
        <strong aria-current="page" className="month-nav__current num">
          {month}
        </strong>
        <Link className="month-nav__step" href={`/reports?month=${nextMonth}`}>
          {nextMonth} <span aria-hidden="true">&rarr;</span>
        </Link>
      </nav>

      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <h2>Summary</h2>
          <span className="dashboard-section__note">{month}</span>
        </div>
        <ul className="dashboard-stats">
          <Stat label="Documents" value={String(summary.documentCount)} />
          <Stat label="Gross" value={formatMoney(summary.grossTotal, null)} />
          <Stat label="Net" value={formatMoney(summary.netTotal, null)} />
          <Stat label="VAT" value={formatMoney(summary.vatTotal, null)} />
          <Stat
            label="Needs review"
            tone={summary.reviewProblemCount > 0 ? "attention" : undefined}
            value={String(summary.reviewProblemCount)}
          />
        </ul>
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2>By category</h2>
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
            <h2>By supplier</h2>
          </div>
          <ProportionBars
            empty="No expenses recorded this month."
            rows={supplierBreakdown.map((row) => ({
              label: row.supplierName ?? "Unknown supplier",
              value: row.total,
            }))}
          />
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section__header">
            <h2>Needs attention</h2>
            <Link href="/inbox">View all in Inbox</Link>
          </div>
          {problematicDocuments.length === 0 ? (
            <p className="content-state">Nothing needs review this month.</p>
          ) : (
            <ul className="data-list">
              {problematicDocuments.map((row) => (
                <li className="data-list__item is-attention" key={row.id}>
                  <Link
                    className="data-list__item-link"
                    href={`/documents/${row.id}`}
                  >
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
                    <div className="data-list__item-meta">
                      {formatDate(row.transactionDate)} ·{" "}
                      <span className="num">
                        {formatMoney(row.total, row.currency)}
                      </span>
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
            <h2>Export</h2>
          </div>
          <div className="dashboard-section__body">
            <a
              className="button button--secondary"
              href={`/api/reports/csv?month=${month}`}
            >
              Export CSV
            </a>
            <form action={generateReportAction}>
              <input name="month" type="hidden" value={month} />
              <button className="button button--primary" type="submit">
                Generate PDF
              </button>
            </form>
          </div>
          {/* The archive is a long tail nobody reads top-to-bottom; keep it
              one click away rather than letting it own the page. */}
          <details className="archive disclosure">
            <summary className="disclosure__summary">
              <span>Generated PDFs</span>
              <span className="count-pill">
                {storedReportsWithLinks.length}
              </span>
            </summary>
            {storedReportsWithLinks.length === 0 ? (
              <p className="content-state">
                No PDF report generated for this month yet.
              </p>
            ) : (
              <ul className="data-list">
                {storedReportsWithLinks.map((report) => (
                  <li className="data-list__item archive__row" key={report.id}>
                    <span>
                      <span className="data-list__item-title">
                        {formatDateTime(report.generatedAt)}
                      </span>
                      <span className="data-list__item-meta">
                        {report.sourceVersion}
                      </span>
                    </span>
                    <a
                      href={report.downloadUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </section>
      </div>
    </div>
  );
}

function Stat({
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
