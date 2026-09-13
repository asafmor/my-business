import "server-only";

import type { DocumentStatus } from "../../domain/documents/types";
import type { FailedProcessing } from "./processing-repository";
import type {
  ProcessDocumentOptions,
  ProcessDocumentResult,
} from "./processing-service";

export const maxProcessingAttempts = 3;

export type ClaimedProcessingTask = {
  attempts: number;
  documentId: string;
  id: string;
  leaseToken: string;
  reprocessing: boolean;
};

export interface BackgroundProcessingRepository {
  claimNext(now: Date): Promise<ClaimedProcessingTask | null>;
  getDocumentStatuses(
    documentIds: readonly string[],
  ): Promise<{ id: string; status: DocumentStatus }[]>;
  reschedule(
    task: ClaimedProcessingTask,
    errorCode: string,
    now: Date,
  ): Promise<void>;
  retry(documentId: string): Promise<boolean>;
  settle(task: ClaimedProcessingTask): Promise<"pending" | "terminal">;
}

export interface BackgroundDocumentProcessor {
  process(
    documentId: string,
    reprocessing?: boolean,
    options?: ProcessDocumentOptions,
  ): Promise<ProcessDocumentResult>;
}

function isRetryable(failure: FailedProcessing): boolean {
  return (
    failure.errorCode === "ANALYZER_FAILURE" ||
    failure.errorCode === "STORAGE_FAILURE"
  );
}

export class BackgroundProcessingService {
  constructor(
    private readonly dependencies: {
      processingRepository: {
        failProcessing(input: FailedProcessing): Promise<void>;
      };
      processor: BackgroundDocumentProcessor;
      repository: BackgroundProcessingRepository;
      now?: () => Date;
    },
  ) {}

  async getDocumentStatuses(documentIds: readonly string[]) {
    return this.dependencies.repository.getDocumentStatuses(documentIds);
  }

  async retry(documentId: string): Promise<boolean> {
    return this.dependencies.repository.retry(documentId);
  }

  async runDueTasks(limit = 10): Promise<number> {
    let processed = 0;
    while (processed < limit) {
      const now = this.now();
      const task = await this.dependencies.repository.claimNext(now);
      if (!task) break;
      processed += 1;

      try {
        await this.dependencies.processor.process(
          task.documentId,
          task.reprocessing,
          {
            onFailure: async (failure) => {
              if (
                isRetryable(failure) &&
                task.attempts < maxProcessingAttempts
              ) {
                await this.dependencies.repository.reschedule(
                  task,
                  failure.errorCode,
                  this.now(),
                );
                return;
              }
              await this.dependencies.processingRepository.failProcessing(
                failure,
              );
              await this.dependencies.repository.settle(task);
            },
            resumeProcessing: task.attempts > 1,
          },
        );
        await this.dependencies.repository.settle(task);
      } catch {
        // Failure state is persisted by the onFailure callback. Cron retries the task.
      }
    }
    return processed;
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }
}
