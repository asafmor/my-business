import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { documentStatuses } from "../../domain/documents/types";
import type {
  AuditEvent,
  Document,
  DocumentFile,
  DocumentStatus,
  DocumentType,
  Extraction,
  JsonValue,
} from "../../domain/documents/types";
import {
  defaultEditableExpenseFields,
  diffExpenseEdit,
} from "../../domain/expenses/edit";
import type { EditableExpenseFields } from "../../domain/expenses/edit";
import type { Expense } from "../../domain/expenses/types";
import { getDatabase } from "../db/client";
import {
  auditEvents,
  categories,
  documentFiles,
  documents,
  expenses,
  extractions,
} from "../db/schema";

export type DocumentDetail = {
  auditEvents: AuditEvent[];
  categories: { id: string; name: string }[];
  categoryName: string | null;
  document: Document;
  expense: Expense | null;
  extractions: Extraction[];
  files: DocumentFile[];
  manualDocumentFields: Set<string>;
  manualExpenseFields: Set<string>;
};

export type DocumentEditInput = EditableExpenseFields & {
  documentId: string;
  documentType: DocumentType;
};

export interface DocumentDetailRepository {
  archive(documentId: string): Promise<boolean>;
  unarchive(documentId: string): Promise<boolean>;
  getDetail(documentId: string): Promise<DocumentDetail | null>;
  markReviewed(documentId: string): Promise<boolean>;
  saveEdit(input: DocumentEditInput): Promise<void>;
  setCategory(documentIds: string[], categoryId: string): Promise<number>;
}

/**
 * Documents archived before the previous status was recorded, and any value no
 * longer in the enum, come back as NEEDS_REVIEW: a restored document is worth
 * a glance rather than silently counting towards reports again.
 */
function restoredStatus(recorded: JsonValue | undefined): DocumentStatus {
  const known =
    typeof recorded === "string" &&
    (documentStatuses as readonly string[]).includes(recorded);
  return known && recorded !== "ARCHIVED"
    ? (recorded as DocumentStatus)
    : "NEEDS_REVIEW";
}

function isManualField(field: string | null): field is string {
  return field !== null;
}

export class DrizzleDocumentDetailRepository implements DocumentDetailRepository {
  constructor(private readonly database: typeof getDatabase = getDatabase) {}

  async getDetail(documentId: string): Promise<DocumentDetail | null> {
    const db = this.database();
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    if (!document) return null;

    const [
      expenseRows,
      activeCategories,
      files,
      extractionRows,
      documentAudit,
    ] = await Promise.all([
      db
        .select()
        .from(expenses)
        .where(eq(expenses.documentId, documentId))
        .limit(1),
      db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(eq(categories.active, true))
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
      db
        .select()
        .from(documentFiles)
        .where(eq(documentFiles.documentId, documentId)),
      db
        .select()
        .from(extractions)
        .where(eq(extractions.documentId, documentId))
        .orderBy(desc(extractions.createdAt)),
      db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.entityType, "DOCUMENT"),
            eq(auditEvents.entityId, documentId),
          ),
        ),
    ]);
    const expense = expenseRows[0] ?? null;

    const expenseAudit = expense
      ? await db
          .select()
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.entityType, "EXPENSE"),
              eq(auditEvents.entityId, expense.id),
            ),
          )
      : [];

    const manualDocumentFields = new Set(
      documentAudit
        .filter((event) => event.action === "MANUAL_EDIT")
        .map((event) => event.field)
        .filter(isManualField),
    );
    const manualExpenseFields = new Set(
      expenseAudit
        .filter(
          (event) =>
            event.action === "MANUAL_EDIT" ||
            event.action === "CATEGORY_CHANGE",
        )
        .map((event) => event.field)
        .filter(isManualField),
    );

    return {
      auditEvents: [...documentAudit, ...expenseAudit].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      ),
      categories: activeCategories,
      categoryName:
        activeCategories.find((category) => category.id === expense?.categoryId)
          ?.name ?? null,
      document,
      expense,
      extractions: extractionRows,
      files,
      manualDocumentFields,
      manualExpenseFields,
    };
  }

  async saveEdit(input: DocumentEditInput): Promise<void> {
    await this.database().transaction(async (transaction) => {
      const [document] = await transaction
        .select({
          transactionDate: documents.transactionDate,
          type: documents.type,
        })
        .from(documents)
        .where(eq(documents.id, input.documentId))
        .limit(1)
        .for("update");
      if (!document) throw new Error("Document not found.");

      const [existingExpense] = await transaction
        .select()
        .from(expenses)
        .where(eq(expenses.documentId, input.documentId))
        .limit(1)
        .for("update");

      const existingFields: EditableExpenseFields = existingExpense
        ? {
            businessUsePercentage: existingExpense.businessUsePercentage,
            categoryId: existingExpense.categoryId,
            currency: existingExpense.currency,
            documentNumber: existingExpense.documentNumber,
            notes: existingExpense.notes,
            paymentMethod: existingExpense.paymentMethod,
            subtotal: existingExpense.subtotal,
            supplierName: existingExpense.supplierName,
            total: existingExpense.total,
            transactionDate: existingExpense.transactionDate,
            vat: existingExpense.vat,
          }
        : defaultEditableExpenseFields;
      const nextFields: EditableExpenseFields = {
        businessUsePercentage: input.businessUsePercentage,
        categoryId: input.categoryId,
        currency: input.currency,
        documentNumber: input.documentNumber,
        notes: input.notes,
        paymentMethod: input.paymentMethod,
        subtotal: input.subtotal,
        supplierName: input.supplierName,
        total: input.total,
        transactionDate: input.transactionDate,
        vat: input.vat,
      };
      const changes = diffExpenseEdit(existingFields, nextFields);

      let expenseId = existingExpense?.id ?? null;
      if (existingExpense) {
        if (changes.length > 0) {
          await transaction
            .update(expenses)
            .set(Object.fromEntries(changes.map((c) => [c.column, c.newValue])))
            .where(eq(expenses.id, existingExpense.id));
        }
      } else {
        const [created] = await transaction
          .insert(expenses)
          .values({ documentId: input.documentId, ...nextFields })
          .returning({ id: expenses.id });
        expenseId = created?.id ?? null;
      }

      if (expenseId && changes.length > 0) {
        await transaction.insert(auditEvents).values(
          changes.map((change) => ({
            action: change.action,
            entityId: expenseId,
            entityType: "EXPENSE" as const,
            field: change.auditField,
            newValue: change.newValue,
            oldValue: change.oldValue,
            source: "USER" as const,
          })),
        );
      }

      const documentUpdates: {
        transactionDate?: string | null;
        type?: DocumentType;
      } = {};
      if (document.type !== input.documentType) {
        documentUpdates.type = input.documentType;
        await transaction.insert(auditEvents).values({
          action: "MANUAL_EDIT",
          entityId: input.documentId,
          entityType: "DOCUMENT",
          field: "type",
          newValue: input.documentType,
          oldValue: document.type,
          source: "USER",
        });
      }
      if (document.transactionDate !== input.transactionDate) {
        documentUpdates.transactionDate = input.transactionDate;
        await transaction.insert(auditEvents).values({
          action: "MANUAL_EDIT",
          entityId: input.documentId,
          entityType: "DOCUMENT",
          field: "transactionDate",
          newValue: input.transactionDate,
          oldValue: document.transactionDate,
          source: "USER",
        });
      }
      if (Object.keys(documentUpdates).length > 0) {
        await transaction
          .update(documents)
          .set(documentUpdates)
          .where(eq(documents.id, input.documentId));
      }
    });
  }

  async markReviewed(documentId: string): Promise<boolean> {
    return this.database().transaction(async (transaction) => {
      const [document] = await transaction
        .select({ status: documents.status })
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1)
        .for("update");
      if (!document || document.status === "ARCHIVED") return false;

      await transaction
        .update(documents)
        .set({
          reviewedAt: new Date(),
          status:
            document.status === "NEEDS_REVIEW" ? "READY" : document.status,
        })
        .where(eq(documents.id, documentId));
      await transaction.insert(auditEvents).values({
        action: "REVIEW",
        entityId: documentId,
        entityType: "DOCUMENT",
        source: "USER",
      });
      return true;
    });
  }

  /**
   * Files a batch of documents under one category in a single transaction, so a
   * half-applied bulk edit is impossible. Documents without an expense row yet
   * get one, matching what saveEdit does for a single document.
   */
  async setCategory(
    documentIds: string[],
    categoryId: string,
  ): Promise<number> {
    if (documentIds.length === 0) return 0;

    return this.database().transaction(async (transaction) => {
      const existing = await transaction
        .select({
          categoryId: expenses.categoryId,
          documentId: expenses.documentId,
          id: expenses.id,
        })
        .from(expenses)
        .where(inArray(expenses.documentId, documentIds))
        .for("update");

      const changed = existing.filter((row) => row.categoryId !== categoryId);
      if (changed.length > 0) {
        await transaction
          .update(expenses)
          .set({ categoryId })
          .where(
            inArray(
              expenses.id,
              changed.map((row) => row.id),
            ),
          );
      }

      const missing = documentIds.filter(
        (id) => !existing.some((row) => row.documentId === id),
      );
      const created =
        missing.length > 0
          ? await transaction
              .insert(expenses)
              .values(
                missing.map((documentId) => ({
                  ...defaultEditableExpenseFields,
                  categoryId,
                  documentId,
                })),
              )
              .returning({ id: expenses.id })
          : [];

      const audited = [
        ...changed.map((row) => ({ id: row.id, oldValue: row.categoryId })),
        ...created.map((row) => ({ id: row.id, oldValue: null })),
      ];
      if (audited.length > 0) {
        await transaction.insert(auditEvents).values(
          audited.map((row) => ({
            action: "CATEGORY_CHANGE" as const,
            entityId: row.id,
            entityType: "EXPENSE" as const,
            field: "category",
            newValue: categoryId,
            oldValue: row.oldValue,
            source: "USER" as const,
          })),
        );
      }

      return audited.length;
    });
  }

  async archive(documentId: string): Promise<boolean> {
    return this.database().transaction(async (transaction) => {
      const [document] = await transaction
        .select({ status: documents.status })
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1)
        .for("update");
      if (!document || document.status === "ARCHIVED") return false;

      await transaction
        .update(documents)
        .set({ status: "ARCHIVED" })
        .where(eq(documents.id, documentId));
      // oldValue is what unarchive() reads back, so the status the user had
      // before archiving is what makes the action reversible.
      await transaction.insert(auditEvents).values({
        action: "ARCHIVE",
        entityId: documentId,
        entityType: "DOCUMENT",
        newValue: "ARCHIVED",
        oldValue: document.status,
        source: "USER",
      });
      return true;
    });
  }

  /** Puts an archived document back into the status it held before archiving. */
  async unarchive(documentId: string): Promise<boolean> {
    return this.database().transaction(async (transaction) => {
      const [document] = await transaction
        .select({ status: documents.status })
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1)
        .for("update");
      if (!document || document.status !== "ARCHIVED") return false;

      const [lastArchive] = await transaction
        .select({ oldValue: auditEvents.oldValue })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.entityType, "DOCUMENT"),
            eq(auditEvents.entityId, documentId),
            eq(auditEvents.action, "ARCHIVE"),
          ),
        )
        .orderBy(desc(auditEvents.createdAt))
        .limit(1);

      const status = restoredStatus(lastArchive?.oldValue);
      await transaction
        .update(documents)
        .set({ status })
        .where(eq(documents.id, documentId));
      await transaction.insert(auditEvents).values({
        action: "UNARCHIVE",
        entityId: documentId,
        entityType: "DOCUMENT",
        newValue: status,
        oldValue: "ARCHIVED",
        source: "USER",
      });
      return true;
    });
  }
}
