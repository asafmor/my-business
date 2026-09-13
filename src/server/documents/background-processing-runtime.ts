import "server-only";

import { DrizzleBackgroundProcessingRepository } from "./background-processing-repository";
import { BackgroundProcessingService } from "./background-processing";
import { getDocumentProcessingService } from "./processing";
import { DrizzleDocumentProcessingRepository } from "./processing-repository";

export function getBackgroundProcessingService(): BackgroundProcessingService {
  return new BackgroundProcessingService({
    processingRepository: new DrizzleDocumentProcessingRepository(),
    processor: getDocumentProcessingService(),
    repository: new DrizzleBackgroundProcessingRepository(),
  });
}
