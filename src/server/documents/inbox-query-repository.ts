import "server-only";

import { desc, eq, inArray, sql } from "drizzle-orm";

import { statusesForSection } from "../../domain/documents/inbox";
import type { DocumentStatus, DocumentType, JsonObject } from "../../domain/documents/types";
import { getDatabase } from "../db/client";
import { categories, documents, expenses, extractions, processingTasks } from "../db/schema";

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

// An exact-hash duplicate (SPEC.md #8) of any other non-archived document.
// Fuzzy duplicate detection (supplier/date/amount) is explicitly deferred.
const isDuplicateExpr = sql<boolean>`exists (
  select 1 from documents as other_document
  where other_document.sha256 = ${documents.sha256}
    and other_document.id <> ${documents.id}
    and other_document.status <> 'ARCHIVED'
)`;

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

    const needsReview = await this.attachReviewReasons(database, needsReviewRaw);

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

  private async attachReviewReasons(
    database: ReturnType<typeof getDatabase>,
    rows: RawInboxRow[],
  ): Promise<InboxRow[]> {
    if (rows.length === 0) return [];

    const extractionRows = await database
      .select({
        createdAt: extractions.createdAt,
        documentId: extractions.documentId,
        normalizedResult: extractions.normalizedResult,
      })
      .from(extractions)
      .where(
        inArray(
          extractions.documentId,
          rows.map((row) => row.id),
        ),
      );

    const latest = new Map<string, { createdAt: Date; normalizedResult: JsonObject }>();
    for (const extraction of extractionRows) {
      const current = latest.get(extraction.documentId);
      if (!current || extraction.createdAt > current.createdAt) {
        latest.set(extraction.documentId, extraction);
      }
    }

    return rows.map((row) => {
      const reviewReasons = latest.get(row.id)?.normalizedResult.reviewReasons;
      return {
        ...row,
        reviewReasons: Array.isArray(reviewReasons) ? (reviewReasons as string[]) : [],
      };
    });
  }
}
