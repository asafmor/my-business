import "server-only";

import {
  FileValidationError,
  maximumUploadBytes,
} from "../storage/file-validation";
import { documentOriginalObjectKey } from "../storage/object-keys";
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
        throw new FileValidationError("הקובץ חורג מגודל ההעלאה המרבי.");
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
        message: "לא ניתן היה להעלות את הקובץ. נסו שוב.",
        status: "failed",
      });
    }
  }

  if (processingQueued) dispatchDueDocumentProcessing();
  return results;
}

/**
 * "Upload anyway" for a share the server ingested: the browser never held
 * those bytes, so the second copy is made from the existing document's stored
 * original. Identical bytes by definition - they matched on SHA-256.
 */
export async function uploadDocumentCopy(
  documentId: string,
  fileName: string,
): Promise<UploadedFileResult> {
  try {
    // Rejects anything that is not a document ID, so an arbitrary form value
    // can never reach into another storage namespace.
    const key = documentOriginalObjectKey(documentId);
    const original = await getR2ObjectStorage().getStoredDocumentContent(key);
    const result = await getDocumentUploadService().upload({
      allowDuplicate: true,
      bytes: original.body,
      fileName,
      mimeType: original.contentType,
    });
    if (result.status === "uploaded") dispatchDueDocumentProcessing();
    return { ...result, fileName };
  } catch (error) {
    logError("upload.copy_failed", error, { documentId });
    return {
      fileName,
      message: "לא ניתן היה להעתיק את הקובץ. נסו שוב.",
      status: "failed",
    };
  }
}
