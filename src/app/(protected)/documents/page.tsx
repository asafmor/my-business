import { DocumentFilters } from "../../../components/documents/document-filters";
import { DocumentsTable } from "../../../components/documents/documents-table";
import { Pagination } from "../../../components/documents/pagination";
import { parseDocumentListQuery } from "../../../domain/documents/query";
import { DrizzleDocumentsQueryRepository } from "../../../server/documents/documents-query-repository";
import { requireSession } from "../../../server/auth/service";

const repository = new DrizzleDocumentsQueryRepository();

const money = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

function sum(values: (string | null)[]): string {
  return money.format(
    values.reduce((running, value) => running + Number(value ?? 0), 0),
  );
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();

  const query = parseDocumentListQuery(await searchParams);
  const [{ matchedTotal, page, pageSize, rows, total }, categories] =
    await Promise.all([
      repository.list(query),
      repository.listActiveCategories(),
    ]);

  return (
    <div className="page">
      <DocumentFilters categories={categories} query={query} />
      {/* One card holds the rows and the footer, so the pager reads as part of
          the table rather than as loose page furniture. */}
      <div className="table-card">
        <DocumentsTable categories={categories} rows={rows} sort={query.sort} />
        <Pagination
          matchedTotal={sum([matchedTotal])}
          page={page}
          pageSize={pageSize}
          pageTotal={sum(rows.map((row) => row.total))}
          rowCount={rows.length}
          total={total}
        />
      </div>
    </div>
  );
}
