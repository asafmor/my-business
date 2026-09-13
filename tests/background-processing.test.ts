import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BackgroundProcessingService,
  maxProcessingAttempts,
} from "../src/server/documents/background-processing";
import type { BackgroundProcessingRepository } from "../src/server/documents/background-processing";
import type { FailedProcessing } from "../src/server/documents/processing-repository";

const documentId = "de305d54-75b4-431b-adb2-eb6b9e546013";
const task = {
  attempts: 1,
  documentId,
  id: "0e305d54-75b4-431b-adb2-eb6b9e546013",
  leaseToken: "1e305d54-75b4-431b-adb2-eb6b9e546013",
  reprocessing: false,
};

function createRepository(
  overrides: Partial<BackgroundProcessingRepository> = {},
): BackgroundProcessingRepository {
  return {
    claimNext: vi.fn().mockResolvedValue(null),
    getDocumentStatuses: vi.fn(),
    reschedule: vi.fn(),
    retry: vi.fn(),
    settle: vi.fn().mockResolvedValue("terminal"),
    ...overrides,
  };
}

describe("background document processing", () => {
  it("claims a duplicated cron dispatch only once", async () => {
    const repository = createRepository({
      claimNext: vi.fn().mockResolvedValueOnce(task).mockResolvedValue(null),
    });
    const processor = {
      process: vi.fn().mockResolvedValue({ status: "ready" }),
    };
    const service = new BackgroundProcessingService({
      processingRepository: { failProcessing: vi.fn() },
      processor,
      repository,
    });

    await Promise.all([service.runDueTasks(), service.runDueTasks()]);

    expect(processor.process).toHaveBeenCalledOnce();
    expect(repository.settle).toHaveBeenCalledWith(task);
  });

  it("retries transient failures only through the configured bound", async () => {
    const failures: FailedProcessing[] = Array.from(
      { length: maxProcessingAttempts },
      () => ({
        documentId,
        errorCode: "ANALYZER_FAILURE",
        reprocessing: false,
      }),
    );
    const repository = createRepository({
      claimNext: vi
        .fn()
        .mockResolvedValueOnce({ ...task, attempts: 1 })
        .mockResolvedValueOnce({ ...task, attempts: 2 })
        .mockResolvedValueOnce({ ...task, attempts: 3 })
        .mockResolvedValue(null),
    });
    const failProcessing = vi.fn();
    const processor = {
      process: vi.fn(async (_documentId, _reprocessing, options) => {
        await options?.onFailure?.(failures.shift()!);
        throw new Error("provider unavailable");
      }),
    };
    const service = new BackgroundProcessingService({
      processingRepository: { failProcessing },
      processor,
      repository,
    });

    await expect(service.runDueTasks()).resolves.toBe(maxProcessingAttempts);

    expect(repository.reschedule).toHaveBeenCalledTimes(2);
    expect(failProcessing).toHaveBeenCalledOnce();
    expect(repository.settle).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: maxProcessingAttempts }),
    );
  });

  it("resumes a reclaimed lease after a server interruption", async () => {
    const reclaimedTask = { ...task, attempts: 2 };
    const repository = createRepository({
      claimNext: vi
        .fn()
        .mockResolvedValueOnce(reclaimedTask)
        .mockResolvedValue(null),
    });
    const processor = {
      process: vi.fn().mockResolvedValue({ status: "ready" }),
    };
    const service = new BackgroundProcessingService({
      processingRepository: { failProcessing: vi.fn() },
      processor,
      repository,
    });

    await service.runDueTasks();

    expect(processor.process).toHaveBeenCalledWith(
      documentId,
      false,
      expect.objectContaining({ resumeProcessing: true }),
    );
  });

  it("fails an invalid AI response without scheduling a retry", async () => {
    const repository = createRepository({
      claimNext: vi.fn().mockResolvedValueOnce(task).mockResolvedValue(null),
    });
    const failProcessing = vi.fn();
    const processor = {
      process: vi.fn(async (_documentId, _reprocessing, options) => {
        await options?.onFailure?.({
          documentId,
          errorCode: "INVALID_AI_RESPONSE",
          reprocessing: false,
        });
        throw new Error("invalid response");
      }),
    };
    const service = new BackgroundProcessingService({
      processingRepository: { failProcessing },
      processor,
      repository,
    });

    await service.runDueTasks();

    expect(repository.reschedule).not.toHaveBeenCalled();
    expect(failProcessing).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "INVALID_AI_RESPONSE" }),
    );
  });
});
