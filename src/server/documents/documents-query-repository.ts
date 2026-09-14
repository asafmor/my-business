import "server-only";

import { and, asc, desc, eq, gte, ilike, lte, ne, or, sql } from "drizzle-orm";

import type { DocumentListQuery } from "../../domain/documents/query";
import { documentListPageSize } from "../../domain/documents/query";
import type { DocumentStatus, DocumentType } from "../../domain/documents/types";
import { getDatabase } from "../db/client";
import { categories, documentFiles, documents, expenses } from "../db/schema";

export type DocumentListRow = {
  categoryName: string | null;
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
  total: number;
};

export interface DocumentsQueryRepository {
  list(query: DocumentListQuery): Promise<DocumentListResult>;
  listActiveCategories(): Promise<{ id: string; name: string }[]>;
}

function buildWhere(query: DocumentListQuery) {
  const conditions = [
    // Archived documents are hidden unless the status filter asks for them.
    query.status ? eq(documents.status, query.status) : ne(documents.status, "ARCHIVED"),
  ];
  if (query.type) conditions.push(eq(documents.type, query.type));
  if (query.categoryId) conditions.push(eq(expenses.categoryId, query.categoryId));
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
    if (query.dateFrom) conditions.push(gte(documents.transactionDate, query.dateFrom));
    if (query.dateTo) conditions.push(lte(documents.transactionDate, query.dateTo));
  }
  if (query.amountMin) conditions.push(gte(expenses.total, query.amountMin));
  if (query.amountMax) conditions.push(lte(expenses.total, query.amountMax));

  return and(...conditions)!;
}

function orderBy(sort: DocumentListQuery["sort"]) {
  switch (sort) {
    case "date-asc":
      return asc(documents.transactionDate);
    case "total-asc":
      return asc(expenses.total);
    case "total-desc":
      return desc(expenses.total);
    default:
      return desc(documents.transactionDate);
  }
}

export class DrizzleDocumentsQueryRepository implements DocumentsQueryRepository {
  constructor(private readonly database: typeof getDatabase = getDatabase) {}

  async list(query: DocumentListQuery): Promise<DocumentListResult> {
    const where = buildWhere(query);
    const pageSize = documentListPageSize;
    const offset = (query.page - 1) * pageSize;

    const [rows, countRows] = await Promise.all([
      this.database()
        .select({
          categoryName: categories.name,
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
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .leftJoin(expenses, eq(expenses.documentId, documents.id))
        .where(where),
    ]);

    return {
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
