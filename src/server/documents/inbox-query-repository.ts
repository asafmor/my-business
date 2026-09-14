import "server-only";

import { desc, eq, inArray } from "drizzle-orm";

import { statusesForSection } from "../../domain/documents/inbox";
import type { DocumentStatus, DocumentType } from "../../domain/documents/types";
import { getDatabase } from "../db/client";
import { categories, documents, expenses, processingTasks } from "../db/schema";

import { attachReviewReasons, isDuplicateExpr } from "./review-signals";

export type InboxRow = {
  businessUsePercentage: string;
  categoryId: string | null;
  categoryName: string | null;
  currency: string | null;
  documentNumber: string | null;
  documentType: DocumentType;
  id: string;
  isDuplicate: boolean;
  lastErrorCode: string | null;
  notes: string | null;
  paymentMethod: string | null;
  reviewReasons: string[];
  status: DocumentStatus;
  subtotal: string | null;
  supplierName: string | null;
  total: string | null;
  transactionDate: string | null;
  vat: string | null;
};

export type InboxResult = {
  failed: InboxRow[];
  needsReview: InboxRow[];
  processing: InboxRow[];
  recentlyCompleted: InboxRow[];
};

export interface InboxQueryRepository {
  list(): Promise<InboxResult>;
}

// ponytail: fixed caps keep the Inbox fast without pagination; add
// pagination per section if any of these are regularly hit.
const sectionLimit = 50;
const recentlyCompletedLimit = 20;

type RawInboxRow = Omit<InboxRow, "reviewReasons">;

export class DrizzleInboxQueryRepository implements InboxQueryRepository {
  constructor(private readonly database: typeof getDatabase = getDatabase) {}

  async list(): Promise<InboxResult> {
    const database = this.database();

    const [needsReviewRaw, processingRaw, failedRaw, recentlyCompletedRaw] =
      await Promise.all([
        this.selectSection(database, statusesForSection("needsReview"), sectionLimit),
        this.selectSection(database, statusesForSection("processing"), sectionLimit),
        this.selectSection(database, statusesForSection("failed"), sectionLimit),
        this.selectSection(
          database,
          statusesForSection("recentlyCompleted"),
          recentlyCompletedLimit,
        ),
      ]);

    const needsReview = await attachReviewReasons(database, needsReviewRaw);

    return {
      failed: failedRaw.map((row) => ({ ...row, reviewReasons: [] })),
      needsReview,
      processing: processingRaw.map((row) => ({ ...row, reviewReasons: [] })),
      recentlyCompleted: recentlyCompletedRaw.map((row) => ({
        ...row,
        reviewReasons: [],
      })),
    };
  }

  private selectSection(
    database: ReturnType<typeof getDatabase>,
    statuses: readonly DocumentStatus[],
    limit: number,
  ): Promise<RawInboxRow[]> {
    return database
      .select({
        businessUsePercentage: expenses.businessUsePercentage,
        categoryId: expenses.categoryId,
        categoryName: categories.name,
        currency: expenses.currency,
        documentNumber: expenses.documentNumber,
        documentType: documents.type,
        id: documents.id,
        isDuplicate: isDuplicateExpr,
        lastErrorCode: processingTasks.lastErrorCode,
        notes: expenses.notes,
        paymentMethod: expenses.paymentMethod,
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
      .leftJoin(processingTasks, eq(processingTasks.documentId, documents.id))
      .where(inArray(documents.status, statuses as DocumentStatus[]))
      .orderBy(desc(documents.updatedAt))
      .limit(limit) as unknown as Promise<RawInboxRow[]>;
  }
}
