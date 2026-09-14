import Link from "next/link";

function pageHref(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/documents?${next.toString()}`;
}

export function Pagination({
  page,
  params,
  pageSize,
  total,
}: {
  page: number;
  params: URLSearchParams;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="pagination">
      {page > 1 && (
        <Link className="text-button" href={pageHref(params, page - 1)}>
          Previous
        </Link>
      )}
      <span className="pagination__status">
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <Link className="text-button" href={pageHref(params, page + 1)}>
          Next
        </Link>
      )}
    </nav>
  );
}
