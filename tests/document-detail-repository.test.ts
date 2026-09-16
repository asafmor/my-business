import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db/client", () => ({ getDatabase: vi.fn() }));
vi.mock("../src/server/db/schema", () => ({
  auditEvents: {},
  categories: {},
  documentFiles: {},
  documents: { id: "documents.id", status: "documents.status" },
  expenses: {},
  extractions: {},
}));

import { DrizzleDocumentDetailRepository } from "../src/server/documents/document-detail-repository";

function chain(result: unknown) {
  const obj: Record<string, unknown> = {};
  for (const method of [
    "from",
    "orderBy",
    "where",
    "limit",
    "for",
    "set",
    "values",
    "returning",
  ]) {
    obj[method] = vi.fn(() => obj);
  }
  (obj as { then: (resolve: (value: unknown) => void) => void }).then = (
    resolve,
  ) => resolve(result);
  return obj as {
    for: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
  };
}

function createTransaction(
  selectResult: unknown[],
  updateResult: unknown[] = [],
) {
  const selectChain = chain(selectResult);
  const updateChain = chain(updateResult);
  const insertChain = chain(undefined);
  return {
    insert: vi.fn(() => insertChain),
    insertChain,
    select: vi.fn(() => selectChain),
    updateChain,
    update: vi.fn(() => updateChain),
  };
}

const documentId = "de305d54-75b4-431b-adb2-eb6b9e546013";

describe("DrizzleDocumentDetailRepository.markReviewed", () => {
  it("moves a NEEDS_REVIEW document to READY, sets reviewedAt, and audits a USER review", async () => {
    const transaction = createTransaction([{ status: "NEEDS_REVIEW" }]);
    const database = {
      transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const repository = new DrizzleDocumentDetailRepository(
      (() => database) as never,
    );

    await expect(repository.markReviewed(documentId)).resolves.toBe(true);

    expect(transaction.updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewedAt: expect.any(Date),
        status: "READY",
      }),
    );
    expect(transaction.insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "REVIEW",
        entityId: documentId,
        entityType: "DOCUMENT",
        source: "USER",
      }),
    );
  });

  it("does not review an already-archived document", async () => {
    const transaction = createTransaction([{ status: "ARCHIVED" }]);
    const database = {
      transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const repository = new DrizzleDocumentDetailRepository(
      (() => database) as never,
    );

    await expect(repository.markReviewed(documentId)).resolves.toBe(false);
    expect(transaction.update).not.toHaveBeenCalled();
  });
});

describe("DrizzleDocumentDetailRepository.archive", () => {
  it("archives a document and records the status it is reversing", async () => {
    const transaction = createTransaction([{ status: "READY" }]);
    const database = {
      transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const repository = new DrizzleDocumentDetailRepository(
      (() => database) as never,
    );

    await expect(repository.archive(documentId)).resolves.toBe(true);

    expect(transaction.updateChain.set).toHaveBeenCalledWith({
      status: "ARCHIVED",
    });
    expect(transaction.insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ARCHIVE",
        newValue: "ARCHIVED",
        oldValue: "READY",
      }),
    );
  });

  it("does not archive a document that is already archived", async () => {
    const transaction = createTransaction([{ status: "ARCHIVED" }]);
    const database = {
      transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const repository = new DrizzleDocumentDetailRepository(
      (() => database) as never,
    );

    await expect(repository.archive(documentId)).resolves.toBe(false);
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.insert).not.toHaveBeenCalled();
  });
});

/** unarchive() reads the document and then the audit trail, so each select
    needs to answer with its own result. */
function createRestoreTransaction(selectResults: unknown[][]) {
  const chains = selectResults.map((result) => chain(result));
  const updateChain = chain([]);
  const insertChain = chain(undefined);
  let call = 0;
  return {
    insert: vi.fn(() => insertChain),
    insertChain,
    select: vi.fn(() => chains[call++] ?? chain([])),
    update: vi.fn(() => updateChain),
    updateChain,
  };
}

describe("DrizzleDocumentDetailRepository.unarchive", () => {
  it("restores the status the document held before it was archived", async () => {
    const transaction = createRestoreTransaction([
      [{ status: "ARCHIVED" }],
      [{ oldValue: "READY" }],
    ]);
    const database = {
      transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const repository = new DrizzleDocumentDetailRepository(
      (() => database) as never,
    );

    await expect(repository.unarchive(documentId)).resolves.toBe(true);

    expect(transaction.updateChain.set).toHaveBeenCalledWith({
      status: "READY",
    });
    expect(transaction.insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UNARCHIVE",
        newValue: "READY",
        oldValue: "ARCHIVED",
      }),
    );
  });

  it("falls back to NEEDS_REVIEW when no earlier status was recorded", async () => {
    const transaction = createRestoreTransaction([
      [{ status: "ARCHIVED" }],
      [],
    ]);
    const database = {
      transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const repository = new DrizzleDocumentDetailRepository(
      (() => database) as never,
    );

    await expect(repository.unarchive(documentId)).resolves.toBe(true);
    expect(transaction.updateChain.set).toHaveBeenCalledWith({
      status: "NEEDS_REVIEW",
    });
  });

  it("never restores a document back into ARCHIVED", async () => {
    const transaction = createRestoreTransaction([
      [{ status: "ARCHIVED" }],
      [{ oldValue: "ARCHIVED" }],
    ]);
    const database = {
      transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const repository = new DrizzleDocumentDetailRepository(
      (() => database) as never,
    );

    await expect(repository.unarchive(documentId)).resolves.toBe(true);
    expect(transaction.updateChain.set).toHaveBeenCalledWith({
      status: "NEEDS_REVIEW",
    });
  });

  it("does nothing to a document that is not archived", async () => {
    const transaction = createRestoreTransaction([[{ status: "READY" }]]);
    const database = {
      transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const repository = new DrizzleDocumentDetailRepository(
      (() => database) as never,
    );

    await expect(repository.unarchive(documentId)).resolves.toBe(false);
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.insert).not.toHaveBeenCalled();
  });
});
