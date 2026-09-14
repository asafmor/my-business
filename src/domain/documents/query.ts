import { documentStatuses, documentTypes } from "./types";
import type { DocumentStatus, DocumentType } from "./types";

export const documentListSorts = [
  "date-desc",
  "date-asc",
  "total-desc",
  "total-asc",
] as const;
export type DocumentListSort = (typeof documentListSorts)[number];

export const documentListPageSize = 25;

export type DocumentListQuery = {
  amountMax: string | null;
  amountMin: string | null;
  categoryId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  month: string | null;
  page: number;
  q: string | null;
  sort: DocumentListSort;
  status: DocumentStatus | null;
  supplier: string | null;
  type: DocumentType | null;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const isoMonthPattern = /^\d{4}-\d{2}$/;
const amountPattern = /^\d+(?:\.\d{1,2})?$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Collapses incidental whitespace so trivial formatting never changes a search. */
export function normalizeSearchQuery(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed.slice(0, 200) : null;
}

function firstValue(
  value: string | readonly string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : (value as string | undefined);
}

function matchOrNull(
  value: string | undefined,
  pattern: RegExp,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return pattern.test(trimmed) ? trimmed : null;
}

/** Parses documents-list URL search params, dropping anything malformed instead of failing. */
export function parseDocumentListQuery(
  params: Record<string, string | readonly string[] | undefined>,
): DocumentListQuery {
  const type = firstValue(params.type);
  const status = firstValue(params.status);
  const sort = firstValue(params.sort);
  const category = firstValue(params.category);
  const page = Number.parseInt(firstValue(params.page) ?? "1", 10);

  return {
    amountMax: matchOrNull(firstValue(params.amountMax), amountPattern),
    amountMin: matchOrNull(firstValue(params.amountMin), amountPattern),
    categoryId: category && uuidPattern.test(category) ? category : null,
    dateFrom: matchOrNull(firstValue(params.dateFrom), isoDatePattern),
    dateTo: matchOrNull(firstValue(params.dateTo), isoDatePattern),
    month: matchOrNull(firstValue(params.month), isoMonthPattern),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    q: normalizeSearchQuery(firstValue(params.q)),
    sort:
      sort && (documentListSorts as readonly string[]).includes(sort)
        ? (sort as DocumentListSort)
        : "date-desc",
    status:
      status && (documentStatuses as readonly string[]).includes(status)
        ? (status as DocumentStatus)
        : null,
    supplier: normalizeSearchQuery(firstValue(params.supplier)),
    type:
      type && (documentTypes as readonly string[]).includes(type)
        ? (type as DocumentType)
        : null,
  };
}
