import { describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ getDatabase: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db/client", () => database);
vi.mock("../src/server/db/schema", () => ({
  documents: { id: "documents.id", status: "documents.status" },
  processingTasks: { documentId: "processing_tasks.document_id" },
}));

import { DrizzleBackgroundProcessingRepository } from "../src/server/documents/background-processing-repository";

const documentId = "de305d54-75b4-431b-adb2-eb6b9e546013";

function createTransaction(returningRows: { id: string }[]) {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  const returning = vi.fn().mockResolvedValue(returningRows);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));

  return {
    insert,
    onConflictDoUpdate,
    transaction: { insert, update },
    update,
    values,
  };
}

describe("background processing retry persistence", () => {
  it("upserts a reset task with the returned document UUID in one transaction", async () => {
    const transaction = createTransaction([{ id: documentId }]);
    const databaseClient = {
      transaction: vi.fn(async (callback) => callback(transaction.transaction)),
    };
    const repository = new DrizzleBackgroundProcessingRepository(
      (() => databaseClient) as never,
    );

    await expect(repository.retry(documentId)).resolves.toBe(true);

    expect(transaction.update).toHaveBeenCalledOnce();
    expect(transaction.insert).toHaveBeenCalledOnce();
    expect(transaction.values).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 0,
        completedAt: null,
        documentId,
        lastErrorCode: null,
        leaseExpiresAt: null,
        leaseToken: null,
        reprocessing: true,
        status: "PENDING",
      }),
    );
    expect(transaction.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({ attempts: 0, status: "PENDING" }),
      }),
    );
    expect(databaseClient.transaction).toHaveBeenCalledOnce();
  });

  it("does not create a task unless the document was FAILED", async () => {
    const transaction = createTransaction([]);
    const databaseClient = {
      transaction: vi.fn(async (callback) => callback(transaction.transaction)),
    };
    const repository = new DrizzleBackgroundProcessingRepository(
      (() => databaseClient) as never,
    );

    await expect(repository.retry(documentId)).resolves.toBe(false);

    expect(transaction.insert).not.toHaveBeenCalled();
    expect(databaseClient.transaction).toHaveBeenCalledOnce();
  });
});
