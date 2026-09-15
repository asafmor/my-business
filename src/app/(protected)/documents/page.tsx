import { DocumentFilters } from "../../../components/documents/document-filters";
import { DocumentsTable } from "../../../components/documents/documents-table";
import { Pagination } from "../../../components/documents/pagination";
import { parseDocumentListQuery } from "../../../domain/documents/query";
import { DrizzleDocumentsQueryRepository } from "../../../server/documents/documents-query-repository";
import { requireSession } from "../../../server/auth/service";

const repository = new DrizzleDocumentsQueryRepository();

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();

  const rawParams = await searchParams;
  const query = parseDocumentListQuery(rawParams);
  const [{ page, pageSize, rows, total }, categories] = await Promise.all([
    repository.list(query),
    repository.listActiveCategories(),
  ]);

  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (key === "page") continue;
    const first = Array.isArray(value) ? value[0] : value;
    if (first) urlParams.set(key, first);
  }

  return (
    <div className="page">
      <DocumentFilters categories={categories} query={query} />
      <DocumentsTable rows={rows} />
      <Pagination
        page={page}
        pageSize={pageSize}
        params={urlParams}
        total={total}
      />
    </div>
  );
}
