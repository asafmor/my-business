import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { DocumentStatus } from "../../domain/documents/types";
import type { ReportCsvRow } from "../../domain/reports/csv";
import { getDatabase } from "../db/client";
import { categories, documents, expenses, processingTasks } from "../db/schema";
import { currentMonthCondition } from "../documents/dashboard-repository";
import type { CategoryBreakdownRow } from "../documents/dashboard-repository";

export type { CategoryBreakdownRow };
import {
  attachReviewReasons,
  isDuplicateExpr,
} from "../documents/review-signals";

export type MonthlySummary = {
  documentCount: number;
  // "before VAT" (SPEC.md 9.1): expenses.subtotal, not total - vat, to avoid
  // drifting from whatever value was actually reviewed/stored.
  netTotal: string;
  grossTotal: string;
  vatTotal: string;
  reviewProblemCount: number;
};

export type SupplierBreakdownRow = {
  supplierName: string | null;
  total: string;
};

export type ProblematicDocumentRow = {
  id: string;
  supplierName: string | null;
  transactionDate: string | null;
  total: string | null;
  currency: string | null;
  status: DocumentStatus;
  isDuplicate: boolean;
  lastErrorCode: string | null;
  reviewReasons: string[];
};

// Documents with a review problem, scoped to the same month/archived
// convention as everything else in this repository.
const problemStatuses: readonly DocumentStatus[] = ["NEEDS_REVIEW", "FAILED"];

export interface MonthlyReportRepository {
  summary(month: string): Promise<MonthlySummary>;
  categoryBreakdown(month: string): Promise<CategoryBreakdownRow[]>;
  supplierBreakdown(month: string): Promise<SupplierBreakdownRow[]>;
  problematicDocuments(month: string): Promise<ProblematicDocumentRow[]>;
  csvRows(month: string): Promise<ReportCsvRow[]>;
}

export class DrizzleMonthlyReportRepository implements MonthlyReportRepository {
  constructor(private readonly database: typeof getDatabase = getDatabase) {}

  async summary(month: string): Promise<MonthlySummary> {
    const [row] = await this.database()
      .select({
        documentCount: sql<number>`count(distinct ${documents.id})::int`,
        grossTotal: sql<string>`coalesce(sum(${expenses.total}), 0)::text`,
        netTotal: sql<string>`coalesce(sum(${expenses.subtotal}), 0)::text`,
        reviewProblemCount: sql<number>`count(distinct ${documents.id}) filter (where ${documents.status} in ('NEEDS_REVIEW', 'FAILED'))::int`,
        vatTotal: sql<string>`coalesce(sum(${expenses.vat}), 0)::text`,
      })
      .from(documents)
      .leftJoin(expenses, eq(expenses.documentId, documents.id))
      .where(currentMonthCondition(month));

    return (
      row ?? {
        documentCount: 0,
        grossTotal: "0",
        netTotal: "0",
        reviewProblemCount: 0,
        vatTotal: "0",
      }
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

  async supplierBreakdown(month: string): Promise<SupplierBreakdownRow[]> {
    return this.database()
      .select({
        supplierName: expenses.supplierName,
        total: sql<string>`coalesce(sum(${expenses.total}), 0)::text`,
      })
      .from(documents)
      .innerJoin(expenses, eq(expenses.documentId, documents.id))
      .where(currentMonthCondition(month))
      .groupBy(expenses.supplierName)
      .orderBy(desc(sql`sum(${expenses.total})`));
  }

  async problematicDocuments(month: string): Promise<ProblematicDocumentRow[]> {
    const database = this.database();
    const rows = await database
      .select({
        currency: expenses.currency,
        id: documents.id,
        isDuplicate: isDuplicateExpr,
        lastErrorCode: processingTasks.lastErrorCode,
        status: documents.status,
        supplierName: expenses.supplierName,
        total: expenses.total,
        transactionDate: documents.transactionDate,
      })
      .from(documents)
      .leftJoin(expenses, eq(expenses.documentId, documents.id))
      .leftJoin(processingTasks, eq(processingTasks.documentId, documents.id))
      .where(
        and(
          currentMonthCondition(month),
          inArray(documents.status, problemStatuses as DocumentStatus[]),
        ),
      )
      .orderBy(desc(documents.updatedAt));

    return attachReviewReasons(database, rows);
  }

  async csvRows(month: string): Promise<ReportCsvRow[]> {
    return this.database()
      .select({
        categoryName: categories.name,
        id: documents.id,
        status: documents.status,
        subtotal: expenses.subtotal,
        supplierName: expenses.supplierName,
        total: expenses.total,
        transactionDate: documents.transactionDate,
        vat: expenses.vat,
      })
      .from(documents)
      .leftJoin(expenses, eq(expenses.documentId, documents.id))
      .leftJoin(categories, eq(categories.id, expenses.categoryId))
      .where(currentMonthCondition(month))
      .orderBy(desc(documents.transactionDate));
  }
}
