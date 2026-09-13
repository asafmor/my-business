import { NextResponse } from "next/server";

import {
  RequestGuardError,
  assertPostFromSameOrigin,
  requireRequestSession,
} from "../../../../server/auth/guards";
import {
  FileValidationError,
  maximumUploadBytes,
} from "../../../../server/storage/file-validation";
import { getDocumentUploadService } from "../../../../server/documents/upload";
import type { DocumentUploadResult } from "../../../../server/documents/upload-service";

type UploadResponseResult =
  | ({ fileName: string } & DocumentUploadResult)
  | { fileName: string; message: string; status: "failed" | "rejected" };

function isFile(value: FormDataEntryValue): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function"
  );
}

function responseError(status: number): NextResponse {
  return NextResponse.json(
    { message: "Upload request was rejected." },
    { status },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    assertPostFromSameOrigin(request);
    await requireRequestSession(request);
  } catch (error) {
    if (error instanceof RequestGuardError) {
      return responseError(error.status);
    }
    throw error;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return responseError(400);
  }

  const files = formData.getAll("files").filter(isFile);
  if (files.length === 0) {
    return NextResponse.json(
      { message: "Choose at least one supported file." },
      { status: 400 },
    );
  }

  const allowDuplicate = formData.get("allowDuplicate") === "true";
  const service = getDocumentUploadService();
  const results: UploadResponseResult[] = [];

  for (const file of files) {
    try {
      if (file.size > maximumUploadBytes) {
        throw new FileValidationError("File exceeds the maximum upload size.");
      }

      results.push({
        ...(await service.upload({
          allowDuplicate,
          bytes: new Uint8Array(await file.arrayBuffer()),
          fileName: file.name,
          mimeType: file.type,
        })),
        fileName: file.name,
      });
    } catch (error) {
      if (error instanceof FileValidationError) {
        results.push({
          fileName: file.name,
          message: error.message,
          status: "rejected",
        });
        continue;
      }

      console.error("Document upload failed", error);
      results.push({
        fileName: file.name,
        message: "The file could not be uploaded. Please try again.",
        status: "failed",
      });
    }
  }

  return NextResponse.json({ results });
}
