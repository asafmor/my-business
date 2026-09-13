import "server-only";

import { getOpenAiDocumentAnalyzer } from "../ai/openai-document-analyzer";
import { getR2ObjectStorage } from "../storage/object-storage";
import { DrizzleDocumentProcessingRepository } from "./processing-repository";
import { DocumentProcessingService } from "./processing-service";

export function getDocumentProcessingService(): DocumentProcessingService {
  return new DocumentProcessingService({
    analyzer: getOpenAiDocumentAnalyzer(),
    repository: new DrizzleDocumentProcessingRepository(),
    storage: getR2ObjectStorage(),
  });
}
