import "server-only";

import { getR2ObjectStorage } from "../storage/object-storage";

import { DrizzleDocumentUploadRepository } from "./upload-repository";
import { DocumentUploadService } from "./upload-service";

export function getDocumentUploadService(): DocumentUploadService {
  return new DocumentUploadService({
    repository: new DrizzleDocumentUploadRepository(),
    storage: getR2ObjectStorage(),
  });
}
