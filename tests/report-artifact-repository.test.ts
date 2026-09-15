import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db/client", () => ({ getDatabase: vi.fn() }));
vi.mock("../src/server/db/schema", () => ({
  auditEvents: {},
  documentFiles: {
    id: "document_files.id",
    objectKey: "document_files.object_key",
  },
  documents: { id: "documents.id" },
  reports: {
    documentId: "reports.document_id",
    fileId: "reports.file_id",
    fileSha256: "reports.file_sha256",
    format: "reports.format",
    generatedAt: "reports.generated_at",
    id: "reports.id",
    reportingMonth: "reports.reporting_month",
    sourceVersion: "reports.source_version",
  },
}));

const { DrizzleReportArtifactRepository } =
  await import("../src/server/reports/report-artifact-repository");

function chain(result: unknown) {
  const obj: Record<string, unknown> = {};
  for (const method of [
    "from",
    "innerJoin",
    "where",
    "orderBy",
    "limit",
    "set",
    "values",
  ]) {
    obj[method] = vi.fn(() => obj);
  }
  (obj as { then: (resolve: (value: unknown) => void) => void }).then = (
    resolve,
  ) => resolve(result);
  return obj as {
    values: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
}

const input = {
  bucket: "my-bucket",
  documentId: "d1",
  fileId: "f1",
  generatedAt: new Date("2026-09-14T12:00:00Z"),
  month: "2026-09",
  objectKey: "reports/2026/09/r1.pdf",
  reportId: "r1",
  sha256: "a".repeat(64),
  sizeBytes: 1024,
  sourceVersion: "monthly-report-v1",
};

describe("DrizzleReportArtifactRepository.createPdfArtifact", () => {
  it("inserts a documents row, a document_files row, and an immutable reports row, never updating or deleting an existing report", async () => {
    const documentsInsert = chain(undefined);
    const filesInsert = chain(undefined);
    const documentsUpdate = chain(undefined);
    const reportsInsert = chain(undefined);
    const auditInsert = chain(undefined);

    let insertCall = 0;
    const insertChains = [
      documentsInsert,
      filesInsert,
      reportsInsert,
      auditInsert,
    ];
    const transaction = {
      insert: vi.fn(() => insertChains[insertCall++]),
      update: vi.fn(() => documentsUpdate),
    };
    const database = {
      transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const repository = new DrizzleReportArtifactRepository(
      (() => database) as never,
    );

    await repository.createPdfArtifact(input);

    expect(reportsInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "d1",
        fileId: "f1",
        fileSha256: input.sha256,
        format: "PDF",
        generatedAt: input.generatedAt,
        id: "r1",
        reportingMonth: "2026-09-01",
        sourceVersion: "monthly-report-v1",
      }),
    );
    expect(filesInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "GENERATED_REPORT",
        objectKey: input.objectKey,
      }),
    );
    // Only the newly-created document is ever updated (to link its file); no
    // update/delete touches a previously generated report.
    expect(transaction.update).toHaveBeenCalledTimes(1);
    expect(transaction.update).toHaveBeenCalledWith(expect.anything());
  });

  it("generating a second report for the same month adds a new row instead of reusing the first", async () => {
    const database = {
      transaction: vi.fn(async (callback) =>
        callback({
          insert: vi.fn(() => chain(undefined)),
          update: vi.fn(() => chain(undefined)),
        }),
      ),
    };
    const repository = new DrizzleReportArtifactRepository(
      (() => database) as never,
    );

    await repository.createPdfArtifact(input);
    await repository.createPdfArtifact({
      ...input,
      reportId: "r2",
      generatedAt: new Date(),
    });

    expect(database.transaction).toHaveBeenCalledTimes(2);
  });
});

describe("DrizzleReportArtifactRepository.listForMonth", () => {
  it("returns stored PDF reports for the month, newest first, with their file's object key", async () => {
    const rows = [
      {
        fileSha256: "b".repeat(64),
        generatedAt: new Date("2026-09-14"),
        id: "r2",
        objectKey: "reports/2026/09/r2.pdf",
        sourceVersion: "monthly-report-v1",
      },
    ];
    const database = { select: vi.fn(() => chain(rows)) };
    const repository = new DrizzleReportArtifactRepository(
      (() => database) as never,
    );

    await expect(repository.listForMonth("2026-09")).resolves.toEqual(rows);
  });
});
