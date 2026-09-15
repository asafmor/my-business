import "server-only";

import { randomUUID } from "node:crypto";

import { reportSourceVersion } from "../../domain/reports/types";
import { getR2ObjectStorage } from "../storage/object-storage";
import { reportPdfObjectKey } from "../storage/object-keys";
import { calculateSha256 } from "../storage/sha256";

import { DrizzleMonthlyReportRepository } from "./monthly-report-repository";
import type { MonthlyReportRepository } from "./monthly-report-repository";
import { buildMonthlyReportPdf } from "./pdf-report";
import { DrizzleReportArtifactRepository } from "./report-artifact-repository";
import type { ReportArtifactRepository } from "./report-artifact-repository";

import type { ObjectStorage } from "../storage/object-storage";

export class MonthlyReportGenerator {
  constructor(
    private readonly dependencies: {
      monthlyReportRepository: MonthlyReportRepository;
      artifactRepository: ReportArtifactRepository;
      storage: ObjectStorage;
    },
  ) {}

  /** Generates and stores an immutable PDF snapshot for the given month. Returns the new reports.id. */
  async generatePdf(month: string): Promise<string> {
    const { monthlyReportRepository, artifactRepository, storage } =
      this.dependencies;

    const [summary, categoryBreakdown, supplierBreakdown] = await Promise.all([
      monthlyReportRepository.summary(month),
      monthlyReportRepository.categoryBreakdown(month),
      monthlyReportRepository.supplierBreakdown(month),
    ]);

    const generatedAt = new Date();
    const pdfBytes = await buildMonthlyReportPdf({
      categoryBreakdown,
      generatedAt,
      month,
      summary,
      supplierBreakdown,
    });
    const sha256 = calculateSha256(pdfBytes);

    const documentId = randomUUID();
    const fileId = randomUUID();
    const reportId = randomUUID();
    const [year, monthNumber] = month.split("-").map(Number);
    const objectKey = reportPdfObjectKey(year, monthNumber, reportId);

    const stored = await storage.putImmutableObject({
      body: pdfBytes,
      contentType: "application/pdf",
      key: objectKey,
      sha256,
    });

    await artifactRepository.createPdfArtifact({
      bucket: stored.bucket,
      documentId,
      fileId,
      generatedAt,
      month,
      objectKey: stored.key,
      reportId,
      sha256,
      sizeBytes: stored.sizeBytes,
      sourceVersion: reportSourceVersion,
    });

    return reportId;
  }
}

export function getMonthlyReportGenerator(): MonthlyReportGenerator {
  return new MonthlyReportGenerator({
    artifactRepository: new DrizzleReportArtifactRepository(),
    monthlyReportRepository: new DrizzleMonthlyReportRepository(),
    storage: getR2ObjectStorage(),
  });
}
