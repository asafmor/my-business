import "server-only";

import { and, asc, eq, gte, ilike, lte, ne, or, sql } from "drizzle-orm";

import { defaultCurrency } from "../../lib/format";
import type { DocumentListQuery } from "../../domain/documents/query";
import { splitSort } from "../../domain/documents/query";
import type {
  DocumentStatus,
  DocumentType,
} from "../../domain/documents/types";
import { getDatabase } from "../db/client";
import { categories, documentFiles, documents, expenses } from "../db/schema";

export type DocumentListRow = {
  categoryName: string | null;
  currency: string | null;
  documentNumber: string | null;
  id: string;
  mimeType: string | null;
  status: DocumentStatus;
  supplierName: string | null;
  total: string | null;
  transactionDate: string | null;
  type: DocumentType;
  vat: string | null;
};

/** Money only adds up within one currency, so a total is always per currency. */
export type CurrencyTotal = { currency: string; total: string };

/*
 * Written as a literal rather than a bound parameter: Postgres matches a
 * grouped expression by its text, and `$1` in the select is not `$3` in the
 * group by.
 */
const currencyBucket = sql<string>`coalesce(${expenses.currency}, ${sql.raw(`'${defaultCurrency}'`)})`;

export type DocumentListResult = {
  page: number;
  pageSize: number;
  rows: DocumentListRow[];
  /** Sums across every matching row, not just this page's. */
  matchedTotals: CurrencyTotal[];
  total: number;
};

export interface DocumentsQueryRepository {
  list(query: DocumentListQuery): Promise<DocumentListResult>;
  listActiveCategories(): Promise<{ id: string; name: string }[]>;
}

function buildWhere(query: DocumentListQuery) {
  const conditions = [
    // Archived documents are hidden unless the status filter asks for them.
    query.status
      ? eq(documents.status, query.status)
      : ne(documents.status, "ARCHIVED"),
  ];
  if (query.type) conditions.push(eq(documents.type, query.type));
  if (query.categoryId)
    conditions.push(eq(expenses.categoryId, query.categoryId));
  if (query.supplier) {
    conditions.push(ilike(expenses.supplierName, `%${query.supplier}%`));
  }
  if (query.q) {
    const pattern = `%${query.q}%`;
    conditions.push(
      or(
        ilike(expenses.supplierName, pattern),
        ilike(expenses.documentNumber, pattern),
        ilike(expenses.notes, pattern),
      )!,
    );
  }
  if (query.month) {
    conditions.push(
      sql`to_char(${documents.transactionDate}, 'YYYY-MM') = ${query.month}`,
    );
  } else {
    if (query.dateFrom)
      conditions.push(gte(documents.transactionDate, query.dateFrom));
    if (query.dateTo)
      conditions.push(lte(documents.transactionDate, query.dateTo));
  }
  if (query.amountMin) conditions.push(gte(expenses.total, query.amountMin));
  if (query.amountMax) conditions.push(lte(expenses.total, query.amountMax));

  return and(...conditions)!;
}

const sortColumns = {
  category: categories.name,
  date: documents.transactionDate,
  status: documents.status,
  supplier: expenses.supplierName,
  total: expenses.total,
  type: documents.type,
  vat: expenses.vat,
} as const;

function orderBy(sort: DocumentListQuery["sort"]) {
  const { column, direction } = splitSort(sort);
  const target = sortColumns[column] ?? documents.transactionDate;
  // Enums sort by their definition order in Postgres, which is not the order of
  // the words on screen. Casting sorts by the label the reader actually sees.
  const key =
    column === "type" || column === "status" ? sql`${target}::text` : target;
  // Nulls last in both directions: an empty cell is never the headline.
  return direction === "asc"
    ? sql`${key} asc nulls last`
    : sql`${key} desc nulls last`;
}

export class DrizzleDocumentsQueryRepository implements DocumentsQueryRepository {
  constructor(private readonly database: typeof getDatabase = getDatabase) {}

  async list(query: DocumentListQuery): Promise<DocumentListResult> {
    const where = buildWhere(query);
    const pageSize = query.pageSize;
    const offset = (query.page - 1) * pageSize;

    const [rows, countRows] = await Promise.all([
      this.database()
        .select({
          categoryName: categories.name,
          currency: expenses.currency,
          documentNumber: expenses.documentNumber,
          id: documents.id,
          mimeType: documentFiles.mimeType,
          status: documents.status,
          supplierName: expenses.supplierName,
          total: expenses.total,
          transactionDate: documents.transactionDate,
          type: documents.type,
          vat: expenses.vat,
        })
        .from(documents)
        .leftJoin(expenses, eq(expenses.documentId, documents.id))
        .leftJoin(categories, eq(categories.id, expenses.categoryId))
        .leftJoin(
          documentFiles,
          and(
            eq(documentFiles.documentId, documents.id),
            eq(documentFiles.kind, "ORIGINAL"),
          ),
        )
        .where(where)
        .orderBy(orderBy(query.sort))
        .limit(pageSize)
        .offset(offset),
      // One pass gives both the count and a total per currency; the row count
      // is just those buckets added back up. A missing currency folds into the
      // default one, or the same money would be totalled twice under one sign.
      this.database()
        .select({
          count: sql<number>`count(*)::int`,
          currency: currencyBucket,
          total: sql<string>`coalesce(sum(${expenses.total}), 0)::text`,
        })
        .from(documents)
        .leftJoin(expenses, eq(expenses.documentId, documents.id))
        .where(where)
        .groupBy(currencyBucket)
        .orderBy(currencyBucket),
    ]);

    return {
      matchedTotals: countRows
        .filter((row) => Number(row.total) !== 0)
        .map(({ currency, total }) => ({ currency, total })),
      page: query.page,
      pageSize,
      rows,
      total: countRows.reduce((running, row) => running + row.count, 0),
    };
  }

  async listActiveCategories(): Promise<{ id: string; name: string }[]> {
    return this.database()
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.active, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name));
  }
}
