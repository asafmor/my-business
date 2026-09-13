import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type {
  DocumentStatus,
  DocumentType,
  JsonObject,
} from "../../domain/documents/types";
import type { NormalizedDocumentExtraction } from "../ai/document-analyzer";
import type { ObjectKey } from "../storage/object-keys";
import { getDatabase } from "../db/client";
import {
  auditEvents,
  categories,
  documentFiles,
  documents,
  expenses,
  extractions,
} from "../db/schema";
import {
  normalizeExpenseField,
  preserveManualExpenseValues,
} from "./processing-authority";

export type ProcessingDocument = {
  activeCategories: { id: string; name: string }[];
  id: string;
  manualDocumentFields: string[];
  manualExpenseFields: string[];
  original: { key: ObjectKey; mimeType: string };
  type: DocumentType;
};

export type CompletedProcessing = {
  document: ProcessingDocument;
  extraction: NormalizedDocumentExtraction;
  model: string;
  provider: string;
  rawResult: JsonObject;
  reprocessing: boolean;
  schemaVersion: string;
  status: "NEEDS_REVIEW" | "READY";
};

export type FailedProcessing = {
  documentId: string;
  errorCode: "ANALYZER_FAILURE" | "INVALID_AI_RESPONSE" | "STORAGE_FAILURE";
  model?: string;
  provider?: string;
  rawResult?: JsonObject;
  reprocessing: boolean;
  schemaVersion?: string;
};

export interface DocumentProcessingRepository {
  beginProcessing(
    documentId: string,
    reprocessing: boolean,
    resumeProcessing?: boolean,
  ): Promise<ProcessingDocument | null>;
  completeProcessing(input: CompletedProcessing): Promise<void>;
  failProcessing(input: FailedProcessing): Promise<void>;
}

function isManualExpenseField(field: string | null): field is string {
  return field !== null;
}

export class DrizzleDocumentProcessingRepository implements DocumentProcessingRepository {
  constructor(private readonly database: typeof getDatabase = getDatabase) {}

  async beginProcessing(
    documentId: string,
    reprocessing: boolean,
    resumeProcessing = false,
  ): Promise<ProcessingDocument | null> {
    const allowedStatuses: DocumentStatus[] = reprocessing
      ? ["UPLOADED", "READY", "NEEDS_REVIEW", "FAILED"]
      : ["UPLOADED"];
    if (resumeProcessing) allowedStatuses.push("PROCESSING");

    return this.database().transaction(async (transaction) => {
      const [claimed] = await transaction
        .update(documents)
        .set({ status: "PROCESSING" })
        .where(
          and(
            eq(documents.id, documentId),
            inArray(documents.status, allowedStatuses),
          ),
        )
        .returning({ id: documents.id, type: documents.type });
      if (!claimed) return null;

      const [original] = await transaction
        .select({
          key: documentFiles.objectKey,
          mimeType: documentFiles.mimeType,
        })
        .from(documentFiles)
        .where(
          and(
            eq(documentFiles.documentId, documentId),
            eq(documentFiles.kind, "ORIGINAL"),
          ),
        )
        .limit(1);
      if (!original) {
        throw new Error("Processing document has no original file.");
      }

      const activeCategories = await transaction
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(eq(categories.active, true));
      const manualExpenseEvents = await transaction
        .select({ field: auditEvents.field })
        .from(auditEvents)
        .innerJoin(expenses, eq(auditEvents.entityId, expenses.id))
        .where(
          and(
            eq(auditEvents.entityType, "EXPENSE"),
            eq(expenses.documentId, documentId),
            inArray(auditEvents.action, ["MANUAL_EDIT", "CATEGORY_CHANGE"]),
          ),
        );
      const manualDocumentEvents = await transaction
        .select({ field: auditEvents.field })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.entityType, "DOCUMENT"),
            eq(auditEvents.entityId, documentId),
            eq(auditEvents.action, "MANUAL_EDIT"),
          ),
        );

      return {
        activeCategories,
        id: claimed.id,
        manualDocumentFields: manualDocumentEvents
          .map((event) => event.field)
          .filter(isManualExpenseField),
        manualExpenseFields: manualExpenseEvents
          .map((event) => event.field)
          .filter(isManualExpenseField),
        original: {
          key: original.key as ObjectKey,
          mimeType: original.mimeType,
        },
        type: claimed.type,
      };
    });
  }

  async completeProcessing(input: CompletedProcessing): Promise<void> {
    await this.database().transaction(async (transaction) => {
      // A recovered lease may overlap a slow prior invocation. Locking the
      // document makes the terminal state check gate all derived writes.
      const [currentDocument] = await transaction
        .select({ status: documents.status })
        .from(documents)
        .where(eq(documents.id, input.document.id))
        .limit(1)
        .for("update");
      if (currentDocument?.status !== "PROCESSING") return;

      const [extraction] = await transaction
        .insert(extractions)
        .values({
          documentId: input.document.id,
          model: input.model,
          normalizedResult: input.extraction as unknown as JsonObject,
          provider: input.provider,
          rawResult: input.rawResult,
          schemaVersion: input.schemaVersion,
        })
        .returning({ id: extractions.id });
      const [existingExpense] = await transaction
        .select()
        .from(expenses)
        .where(eq(expenses.documentId, input.document.id))
        .limit(1);
      // Refresh authority markers here so edits made while AI was running win.
      const currentManualExpenseEvents = await transaction
        .select({ field: auditEvents.field })
        .from(auditEvents)
        .innerJoin(expenses, eq(auditEvents.entityId, expenses.id))
        .where(
          and(
            eq(auditEvents.entityType, "EXPENSE"),
            eq(expenses.documentId, input.document.id),
            inArray(auditEvents.action, ["MANUAL_EDIT", "CATEGORY_CHANGE"]),
          ),
        );
      const currentManualDocumentEvents = await transaction
        .select({ field: auditEvents.field })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.entityType, "DOCUMENT"),
            eq(auditEvents.entityId, input.document.id),
            eq(auditEvents.action, "MANUAL_EDIT"),
          ),
        );
      const categoryId = input.extraction.suggestedCategory
        ? (input.document.activeCategories.find(
            (category) => category.name === input.extraction.suggestedCategory,
          )?.id ?? null)
        : null;
      const manualFields = new Set(
        [
          ...input.document.manualExpenseFields,
          ...currentManualExpenseEvents
            .map((event) => event.field)
            .filter(isManualExpenseField),
        ].map(normalizeExpenseField),
      );
      const extractedExpense = {
        categoryId,
        currency: input.extraction.currency,
        documentNumber: input.extraction.documentNumber,
        notes: input.extraction.description,
        paymentMethod: input.extraction.paymentMethod,
        reportingMonth: input.extraction.transactionDate
          ? `${input.extraction.transactionDate.slice(0, 7)}-01`
          : null,
        subtotal: input.extraction.subtotal,
        supplierIdentifier: input.extraction.supplierIdentifier,
        supplierName: input.extraction.supplierName,
        total: input.extraction.total,
        transactionDate: input.extraction.transactionDate,
        vat: input.extraction.vat,
      };
      const expenseValues = existingExpense
        ? preserveManualExpenseValues(
            existingExpense,
            extractedExpense,
            manualFields,
          )
        : extractedExpense;

      if (existingExpense) {
        await transaction
          .update(expenses)
          .set(expenseValues)
          .where(eq(expenses.id, existingExpense.id));
      } else {
        await transaction.insert(expenses).values({
          documentId: input.document.id,
          ...expenseValues,
        });
      }

      const manualDocumentFields = new Set([
        ...input.document.manualDocumentFields,
        ...currentManualDocumentEvents
          .map((event) => event.field)
          .filter(isManualExpenseField),
      ]);
      const preserveType = manualDocumentFields.has("type");
      const preserveDate = manualDocumentFields.has("transactionDate");
      await transaction
        .update(documents)
        .set({
          status: input.status,
          transactionDate: preserveDate
            ? undefined
            : input.extraction.transactionDate,
          type: preserveType
            ? input.document.type
            : (input.extraction.documentType ?? input.document.type),
        })
        .where(
          and(
            eq(documents.id, input.document.id),
            eq(documents.status, "PROCESSING"),
          ),
        );
      await transaction.insert(auditEvents).values({
        action: input.reprocessing ? "REPROCESSING" : "EXTRACTION",
        entityId: input.document.id,
        entityType: "DOCUMENT",
        newValue: {
          extractionId: extraction.id,
          reviewReasons: input.extraction.reviewReasons,
          schemaVersion: input.schemaVersion,
          status: input.status,
        },
        source: "AI",
      });
    });
  }

  async failProcessing(input: FailedProcessing): Promise<void> {
    await this.database().transaction(async (transaction) => {
      const [currentDocument] = await transaction
        .select({ status: documents.status })
        .from(documents)
        .where(eq(documents.id, input.documentId))
        .limit(1)
        .for("update");
      if (currentDocument?.status !== "PROCESSING") return;

      if (
        input.rawResult &&
        input.provider &&
        input.model &&
        input.schemaVersion
      ) {
        await transaction.insert(extractions).values({
          documentId: input.documentId,
          model: input.model,
          normalizedResult: { failure: input.errorCode },
          provider: input.provider,
          rawResult: input.rawResult,
          schemaVersion: input.schemaVersion,
        });
      }
      await transaction
        .update(documents)
        .set({ status: "FAILED" })
        .where(
          and(
            eq(documents.id, input.documentId),
            eq(documents.status, "PROCESSING"),
          ),
        );
      await transaction.insert(auditEvents).values({
        action: input.reprocessing ? "REPROCESSING" : "EXTRACTION",
        entityId: input.documentId,
        entityType: "DOCUMENT",
        newValue: { failure: input.errorCode },
        source: "SYSTEM",
      });
    });
  }
}
