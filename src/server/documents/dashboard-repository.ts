import "server-only";

import { and, desc, eq, ne, sql } from "drizzle-orm";

import type { DocumentStatus } from "../../domain/documents/types";
import { getDatabase } from "../db/client";
import { categories, documents, expenses } from "../db/schema";

export type DashboardSummary = {
  documentCount: number;
  needsReviewCount: number;
  totalExpenses: string;
  vatTotal: string;
};

export type CategoryBreakdownRow = {
  categoryName: string | null;
  total: string;
};

export type RecentDocumentRow = {
  at: Date;
  id: string;
  status: DocumentStatus;
  supplierName: string | null;
};

export interface DashboardRepository {
  categoryBreakdown(month: string): Promise<CategoryBreakdownRow[]>;
  hasAnyDocuments(): Promise<boolean>;
  recentlyEdited(limit: number): Promise<RecentDocumentRow[]>;
  recentlyUploaded(limit: number): Promise<RecentDocumentRow[]>;
  summary(month: string): Promise<DashboardSummary>;
}

// Documents without a transaction date fall out of every month bucket below,
// same as month filtering in documents-query-repository.ts. Exported so
// monthly-report-repository.ts shares this exact predicate instead of
// redefining it.
export function currentMonthCondition(month: string) {
  return and(
    ne(documents.status, "ARCHIVED"),
    sql`to_char(${documents.transactionDate}, 'YYYY-MM') = ${month}`,
  );
}

export class DrizzleDashboardRepository implements DashboardRepository {
  constructor(private readonly database: typeof getDatabase = getDatabase) {}

  async summary(month: string): Promise<DashboardSummary> {
    const [row] = await this.database()
      .select({
        documentCount: sql<number>`count(distinct ${documents.id})::int`,
        needsReviewCount: sql<number>`count(distinct ${documents.id}) filter (where ${documents.status} = 'NEEDS_REVIEW')::int`,
        totalExpenses: sql<string>`coalesce(sum(${expenses.total}), 0)::text`,
        vatTotal: sql<string>`coalesce(sum(${expenses.vat}), 0)::text`,
      })
      .from(documents)
      .leftJoin(expenses, eq(expenses.documentId, documents.id))
      .where(currentMonthCondition(month));

    return (
      row ?? { documentCount: 0, needsReviewCount: 0, totalExpenses: "0", vatTotal: "0" }
    );
  }

  async categoryBreakdown(month: string): Promise<CategoryBreakdownRow[]> {
    return this.database()
      .select({
        categoryName: categories.name,
        total: sql<string>`coalesce(sum(${expenses.total}), 0)::text`,
      })
      .from(documents)
      .innerJoin(expenses, eq(expenses.documentId, documents.id))
      .leftJoin(categories, eq(categories.id, expenses.categoryId))
      .where(currentMonthCondition(month))
      .groupBy(categories.id, categories.name)
      .orderBy(desc(sql`sum(${expenses.total})`));
  }

  async hasAnyDocuments(): Promise<boolean> {
    const rows = await this.database().select({ id: documents.id }).from(documents).limit(1);
    return rows.length > 0;
  }

  recentlyUploaded(limit: number): Promise<RecentDocumentRow[]> {
    return this.recent(documents.createdAt, limit);
  }

  recentlyEdited(limit: number): Promise<RecentDocumentRow[]> {
    return this.recent(documents.updatedAt, limit);
  }

  private recent(
    orderColumn: typeof documents.createdAt | typeof documents.updatedAt,
    limit: number,
  ): Promise<RecentDocumentRow[]> {
    return this.database()
      .select({
        at: orderColumn,
        id: documents.id,
        status: documents.status,
        supplierName: expenses.supplierName,
      })
      .from(documents)
      .leftJoin(expenses, eq(expenses.documentId, documents.id))
      .where(ne(documents.status, "ARCHIVED"))
      .orderBy(desc(orderColumn))
      .limit(limit);
  }
}
