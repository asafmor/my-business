import "server-only";

import {
  DocumentAnalyzerError,
  normalizeDocumentExtraction,
} from "../ai/document-analyzer";
import type {
  DocumentAnalyzer,
  NormalizedDocumentExtraction,
} from "../ai/document-analyzer";
import type { ObjectStorage } from "../storage/object-storage";
import type {
  DocumentProcessingRepository,
  FailedProcessing,
  ProcessingDocument,
} from "./processing-repository";

export type DocumentReviewRule = (
  extraction: NormalizedDocumentExtraction,
) => readonly string[];

export type ProcessDocumentResult =
  | { status: "already-processing" }
  | { status: "needs-review"; reviewReasons: readonly string[] }
  | { status: "ready" };

function supportedMimeType(
  mimeType: string,
): mimeType is "application/pdf" | "image/jpeg" | "image/png" | "image/webp" {
  return ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
    mimeType,
  );
}

export class DocumentProcessingService {
  constructor(
    private readonly dependencies: {
      analyzer: DocumentAnalyzer;
      repository: DocumentProcessingRepository;
      reviewRules?: readonly DocumentReviewRule[];
      storage: ObjectStorage;
    },
  ) {}

  async process(
    documentId: string,
    reprocessing = false,
  ): Promise<ProcessDocumentResult> {
    const document = await this.dependencies.repository.beginProcessing(
      documentId,
      reprocessing,
    );
    if (!document) return { status: "already-processing" };

    let failureCode: FailedProcessing["errorCode"] = "STORAGE_FAILURE";
    try {
      const content = await this.dependencies.storage.getStoredDocumentContent(
        document.original.key,
      );
      if (!supportedMimeType(content.contentType)) {
        throw new Error("Stored document has an unsupported content type.");
      }
      failureCode = "ANALYZER_FAILURE";
      const result = await this.dependencies.analyzer.analyze({
        categoryNames: document.activeCategories.map(
          (category) => category.name,
        ),
        content: content.body,
        mimeType: content.contentType,
      });
      const extraction = normalizeDocumentExtraction(
        result.extraction,
        document.activeCategories.map((category) => category.name),
      );
      const ruleReasons =
        this.dependencies.reviewRules?.flatMap((rule) => rule(extraction)) ??
        [];
      const reviewReasons = [
        ...new Set([...extraction.reviewReasons, ...ruleReasons]),
      ];
      const completedExtraction = { ...extraction, reviewReasons };
      const status = reviewReasons.length === 0 ? "READY" : "NEEDS_REVIEW";

      await this.dependencies.repository.completeProcessing({
        document,
        extraction: completedExtraction,
        model: result.model,
        provider: result.provider,
        rawResult: result.rawResult,
        reprocessing,
        schemaVersion: result.schemaVersion,
        status,
      });
      return status === "READY"
        ? { status: "ready" }
        : { status: "needs-review", reviewReasons };
    } catch (error) {
      await this.dependencies.repository.failProcessing(
        this.failure(document, reprocessing, error, failureCode),
      );
      throw error;
    }
  }

  reprocess(documentId: string): Promise<ProcessDocumentResult> {
    return this.process(documentId, true);
  }

  private failure(
    document: ProcessingDocument,
    reprocessing: boolean,
    error: unknown,
    errorCode: FailedProcessing["errorCode"],
  ): FailedProcessing {
    if (error instanceof DocumentAnalyzerError) {
      return {
        documentId: document.id,
        errorCode: error.details?.rawResult ? "INVALID_AI_RESPONSE" : errorCode,
        model: error.details?.model,
        provider: error.details?.provider,
        rawResult: error.details?.rawResult,
        reprocessing,
        schemaVersion: error.details?.schemaVersion,
      };
    }
    return {
      documentId: document.id,
      errorCode,
      reprocessing,
    };
  }
}
