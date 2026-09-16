import "server-only";

import {
  FileValidationError,
  maximumUploadBytes,
} from "../storage/file-validation";
import { getR2ObjectStorage } from "../storage/object-storage";
import { logError } from "../observability/logger";

import { dispatchDueDocumentProcessing } from "./processing-dispatcher";
import { DrizzleDocumentUploadRepository } from "./upload-repository";
import { DocumentUploadService } from "./upload-service";
import type { DocumentUploadResult } from "./upload-service";

function isFile(value: FormDataEntryValue): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function"
  );
}

export type UploadedFileResult =
  | ({ fileName: string } & DocumentUploadResult)
  | { fileName: string; message: string; status: "failed" | "rejected" };

export function getDocumentUploadService(): DocumentUploadService {
  return new DocumentUploadService({
    repository: new DrizzleDocumentUploadRepository(),
    storage: getR2ObjectStorage(),
  });
}

/**
 * The single ingestion path for uploaded originals: browser uploads and
 * Android share-target POSTs both land here, so validation, storage, and
 * background processing stay identical whichever door a file came through.
 * Non-file form entries are dropped, so an empty result means nothing usable
 * arrived.
 */
export async function uploadDocumentFiles(
  entries: readonly FormDataEntryValue[],
  options: { allowDuplicate: boolean },
): Promise<UploadedFileResult[]> {
  const service = getDocumentUploadService();
  const results: UploadedFileResult[] = [];
  let processingQueued = false;

  for (const file of entries.filter(isFile)) {
    try {
      if (file.size > maximumUploadBytes) {
        throw new FileValidationError("File exceeds the maximum upload size.");
      }

      const result = await service.upload({
        allowDuplicate: options.allowDuplicate,
        bytes: new Uint8Array(await file.arrayBuffer()),
        fileName: file.name,
        mimeType: file.type,
      });
      if (result.status === "uploaded") processingQueued = true;
      results.push({ ...result, fileName: file.name });
    } catch (error) {
      if (error instanceof FileValidationError) {
        results.push({
          fileName: file.name,
          message: error.message,
          status: "rejected",
        });
        continue;
      }

      logError("upload.failed", error, { fileName: file.name });
      results.push({
        fileName: file.name,
        message: "The file could not be uploaded. Please try again.",
        status: "failed",
      });
    }
  }

  if (processingQueued) dispatchDueDocumentProcessing();
  return results;
}
