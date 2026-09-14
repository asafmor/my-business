import "server-only";

import { suspiciousVatReasons } from "../../domain/expenses/review-rules";
import { getOpenAiDocumentAnalyzer } from "../ai/openai-document-analyzer";
import { getR2ObjectStorage } from "../storage/object-storage";
import { DrizzleDocumentProcessingRepository } from "./processing-repository";
import { DocumentProcessingService } from "./processing-service";

export function getDocumentProcessingService(): DocumentProcessingService {
  return new DocumentProcessingService({
    analyzer: getOpenAiDocumentAnalyzer(),
    repository: new DrizzleDocumentProcessingRepository(),
    reviewRules: [suspiciousVatReasons],
    storage: getR2ObjectStorage(),
  });
}
