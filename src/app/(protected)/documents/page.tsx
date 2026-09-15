import { DocumentFilters } from "../../../components/documents/document-filters";
import { DocumentsEmpty } from "../../../components/documents/documents-empty";
import { DocumentsTable } from "../../../components/documents/documents-table";
import { Pagination } from "../../../components/documents/pagination";
import {
  activeFilterCount,
  parseDocumentListQuery,
} from "../../../domain/documents/query";
import type {
  CurrencyTotal,
  DocumentListRow,
} from "../../../server/documents/documents-query-repository";
import { defaultCurrency } from "../../../lib/format";
import { DrizzleDocumentsQueryRepository } from "../../../server/documents/documents-query-repository";
import { requireSession } from "../../../server/auth/service";

const repository = new DrizzleDocumentsQueryRepository();

/** The page's own totals, bucketed exactly as the query buckets its own. */
function pageTotals(rows: DocumentListRow[]): CurrencyTotal[] {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    if (row.total === null) continue;
    const currency = row.currency ?? defaultCurrency;
    buckets.set(currency, (buckets.get(currency) ?? 0) + +row.total);
  }
  return [...buckets]
    .filter(([, total]) => total !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, total]) => ({ currency, total: String(total) }));
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();

  const query = parseDocumentListQuery(await searchParams);
  const [{ matchedTotals, page, pageSize, rows, total }, categories] =
    await Promise.all([
      repository.list(query),
      repository.listActiveCategories(),
    ]);

  return (
    <div className="page">
      <DocumentFilters categories={categories} query={query} />
      {/* One card holds the rows and the footer, so the pager reads as part of
          the table rather than as loose page furniture. A pager over nothing is
          furniture with no room, so an empty result gets the card to itself. */}
      <div className="table-card">
        {rows.length === 0 ? (
          <DocumentsEmpty isFiltered={activeFilterCount(query) > 0} />
        ) : (
          <>
            <DocumentsTable
              categories={categories}
              rows={rows}
              sort={query.sort}
            />
            <Pagination
              matchedTotals={matchedTotals}
              page={page}
              pageSize={pageSize}
              pageTotals={pageTotals(rows)}
              rowCount={rows.length}
              total={total}
            />
          </>
        )}
      </div>
    </div>
  );
}
