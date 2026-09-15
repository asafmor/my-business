import "server-only";

import { and, asc, eq, gte, ilike, lte, ne, or, sql } from "drizzle-orm";

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

export type DocumentListResult = {
  page: number;
  pageSize: number;
  rows: DocumentListRow[];
  /** Sum of every matching row's total, not just this page's. */
  matchedTotal: string;
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
  // Nulls last in both directions: an empty cell is never the headline.
  return direction === "asc"
    ? sql`${target} asc nulls last`
    : sql`${target} desc nulls last`;
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
      this.database()
        .select({
          count: sql<number>`count(*)::int`,
          matchedTotal: sql<string>`coalesce(sum(${expenses.total}), 0)::text`,
        })
        .from(documents)
        .leftJoin(expenses, eq(expenses.documentId, documents.id))
        .where(where),
    ]);

    return {
      matchedTotal: countRows[0]?.matchedTotal ?? "0",
      page: query.page,
      pageSize,
      rows,
      total: countRows[0]?.count ?? 0,
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
