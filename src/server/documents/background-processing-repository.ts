import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, eq, inArray, lte, or } from "drizzle-orm";

import { getDatabase } from "../db/client";
import { documents, processingTasks } from "../db/schema";
import type {
  BackgroundProcessingRepository,
  ClaimedProcessingTask,
} from "./background-processing";

const processingLeaseMilliseconds = 5 * 60 * 1_000;
const retryDelaysMilliseconds = [60_000, 5 * 60_000] as const;

function retryDelay(attempts: number): number {
  return retryDelaysMilliseconds[
    Math.min(attempts - 1, retryDelaysMilliseconds.length - 1)
  ];
}

export class DrizzleBackgroundProcessingRepository implements BackgroundProcessingRepository {
  constructor(private readonly database: typeof getDatabase = getDatabase) {}

  async claimNext(now: Date): Promise<ClaimedProcessingTask | null> {
    return this.database().transaction(async (transaction) => {
      const [task] = await transaction
        .select()
        .from(processingTasks)
        .where(
          or(
            and(
              eq(processingTasks.status, "PENDING"),
              lte(processingTasks.nextAttemptAt, now),
            ),
            and(
              eq(processingTasks.status, "PROCESSING"),
              lte(processingTasks.leaseExpiresAt, now),
            ),
          ),
        )
        .orderBy(asc(processingTasks.nextAttemptAt))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!task) return null;

      const leaseToken = randomUUID();
      const [claimed] = await transaction
        .update(processingTasks)
        .set({
          attempts: task.attempts + 1,
          leaseExpiresAt: new Date(now.getTime() + processingLeaseMilliseconds),
          leaseToken,
          status: "PROCESSING",
        })
        .where(eq(processingTasks.id, task.id))
        .returning();
      if (!claimed) return null;

      return {
        attempts: claimed.attempts,
        documentId: claimed.documentId,
        id: claimed.id,
        leaseToken,
        reprocessing: claimed.reprocessing,
      };
    });
  }

  async getDocumentStatuses(documentIds: readonly string[]) {
    if (documentIds.length === 0) return [];
    return this.database()
      .select({ id: documents.id, status: documents.status })
      .from(documents)
      .where(inArray(documents.id, [...documentIds]));
  }

  async reschedule(
    task: ClaimedProcessingTask,
    errorCode: string,
    now: Date,
  ): Promise<void> {
    await this.database().transaction(async (transaction) => {
      const [rescheduled] = await transaction
        .update(processingTasks)
        .set({
          lastErrorCode: errorCode,
          leaseExpiresAt: null,
          leaseToken: null,
          nextAttemptAt: new Date(now.getTime() + retryDelay(task.attempts)),
          status: "PENDING",
        })
        .where(
          and(
            eq(processingTasks.id, task.id),
            eq(processingTasks.leaseToken, task.leaseToken),
            eq(processingTasks.status, "PROCESSING"),
          ),
        )
        .returning({ documentId: processingTasks.documentId });
      if (!rescheduled) return;

      await transaction
        .update(documents)
        .set({ status: "UPLOADED" })
        .where(
          and(
            eq(documents.id, task.documentId),
            eq(documents.status, "PROCESSING"),
          ),
        );
    });
  }

  // Also the "reprocess" trigger from the document detail page: this reuses
  // the retry pathway rather than a second processing-queue entry point, so
  // it accepts every status process()/beginProcessing() allow reprocessing
  // from (not just FAILED).
  async retry(documentId: string): Promise<boolean> {
    return this.database().transaction(async (transaction) => {
      const [document] = await transaction
        .update(documents)
        .set({ status: "UPLOADED" })
        .where(
          and(
            eq(documents.id, documentId),
            inArray(documents.status, ["UPLOADED", "READY", "NEEDS_REVIEW", "FAILED"]),
          ),
        )
        .returning({ id: documents.id });
      if (!document) return false;

      const reset = {
        attempts: 0,
        completedAt: null,
        lastErrorCode: null,
        leaseExpiresAt: null,
        leaseToken: null,
        nextAttemptAt: new Date(),
        reprocessing: true,
        status: "PENDING" as const,
      };
      await transaction
        .insert(processingTasks)
        .values({ documentId: document.id, ...reset })
        .onConflictDoUpdate({ set: reset, target: processingTasks.documentId });
      return true;
    });
  }

  async settle(task: ClaimedProcessingTask): Promise<"pending" | "terminal"> {
    return this.database().transaction(async (transaction) => {
      const [document] = await transaction
        .select({ status: documents.status })
        .from(documents)
        .where(eq(documents.id, task.documentId))
        .limit(1);
      if (
        !document ||
        document.status === "UPLOADED" ||
        document.status === "PROCESSING"
      ) {
        return "pending";
      }

      await transaction
        .update(processingTasks)
        .set({
          completedAt: new Date(),
          leaseExpiresAt: null,
          leaseToken: null,
          status: document.status === "FAILED" ? "FAILED" : "COMPLETE",
        })
        .where(
          and(
            eq(processingTasks.id, task.id),
            eq(processingTasks.leaseToken, task.leaseToken),
          ),
        );
      return "terminal";
    });
  }
}
