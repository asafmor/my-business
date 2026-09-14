import Link from "next/link";

import { generateReportAction } from "./actions";
import { attentionReasons } from "../../../domain/documents/attention-reasons";
import { parseReportMonth, shiftReportMonth } from "../../../domain/reports/month";
import { formatDate, formatDateTime, formatMoney, humanizeEnumValue } from "../../../lib/format";
import { createPrivateReadUrl } from "../../../server/storage/private-access";
import { getR2ObjectStorage } from "../../../server/storage/object-storage";
import { parseObjectKey } from "../../../server/storage/object-keys";
import { DrizzleMonthlyReportRepository } from "../../../server/reports/monthly-report-repository";
import { DrizzleReportArtifactRepository } from "../../../server/reports/report-artifact-repository";
import { requireSession } from "../../../server/auth/service";

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
  const month = parseReportMonth(Array.isArray(rawMonth) ? rawMonth[0] : rawMonth);
  const previousMonth = shiftReportMonth(month, -1);
  const nextMonth = shiftReportMonth(month, 1);

  const [summary, categoryBreakdown, supplierBreakdown, problematicDocuments, storedReports] =
    await Promise.all([
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

      <nav className="dashboard-section" aria-label="Month">
        <Link href={`/reports?month=${previousMonth}`}>&larr; {previousMonth}</Link>
        {" · "}
        <strong>{month}</strong>
        {" · "}
        <Link href={`/reports?month=${nextMonth}`}>{nextMonth} &rarr;</Link>
      </nav>

      <section className="dashboard-section">
        <h2>Summary</h2>
        <ul className="dashboard-stats">
          <li className="dashboard-stat">
            <span className="dashboard-stat__value">{summary.documentCount}</span>
            <span className="dashboard-stat__label">Documents</span>
          </li>
          <li className="dashboard-stat">
            <span className="dashboard-stat__value">{formatMoney(summary.grossTotal, null)}</span>
            <span className="dashboard-stat__label">Total expenses (gross)</span>
          </li>
          <li className="dashboard-stat">
            <span className="dashboard-stat__value">{formatMoney(summary.netTotal, null)}</span>
            <span className="dashboard-stat__label">Before VAT (net)</span>
          </li>
          <li className="dashboard-stat">
            <span className="dashboard-stat__value">{formatMoney(summary.vatTotal, null)}</span>
            <span className="dashboard-stat__label">VAT</span>
          </li>
          <li className="dashboard-stat">
            <span className="dashboard-stat__value">{summary.reviewProblemCount}</span>
            <span className="dashboard-stat__label">Needing review</span>
          </li>
        </ul>
      </section>

      <section className="dashboard-section">
        <h2>By category</h2>
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
        <h2>By supplier</h2>
        {supplierBreakdown.length === 0 ? (
          <p className="content-state">No expenses recorded this month.</p>
        ) : (
          <ul className="data-list">
            {supplierBreakdown.map((row) => (
              <li className="data-list__item" key={row.supplierName ?? "unknown"}>
                <div className="data-list__item-header">
                  <span>{row.supplierName ?? "Unknown supplier"}</span>
                  <span>{formatMoney(row.total, null)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dashboard-section">
        <h2>Documents needing attention</h2>
        {problematicDocuments.length === 0 ? (
          <p className="content-state">Nothing needs review this month.</p>
        ) : (
          <ul className="data-list">
            {problematicDocuments.map((row) => (
              <li className="data-list__item" key={row.id}>
                <Link className="data-list__item-link" href={`/documents/${row.id}`}>
                  <div className="data-list__item-header">
                    <span className="status-badge">{humanizeEnumValue(row.status)}</span>
                  </div>
                  <div className="data-list__item-title">{row.supplierName ?? "Unknown supplier"}</div>
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
        <h2>Export</h2>
        <div className="dashboard-quick-actions">
          <a className="button button--secondary" href={`/api/reports/csv?month=${month}`}>
            Export CSV
          </a>
          <form action={generateReportAction}>
            <input name="month" type="hidden" value={month} />
            <button className="button button--primary" type="submit">
              Generate PDF report
            </button>
          </form>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Generated PDF reports</h2>
        {storedReportsWithLinks.length === 0 ? (
          <p className="content-state">No PDF report generated for this month yet.</p>
        ) : (
          <ul className="data-list">
            {storedReportsWithLinks.map((report) => (
              <li className="data-list__item" key={report.id}>
                <div className="data-list__item-header">
                  <span>{formatDateTime(report.generatedAt)}</span>
                  <a href={report.downloadUrl} rel="noreferrer" target="_blank">
                    Download
                  </a>
                </div>
                <div className="data-list__item-meta">Source version {report.sourceVersion}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
