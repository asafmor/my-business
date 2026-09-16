import { NextResponse } from "next/server";

import {
  RequestGuardError,
  assertPostFromSameOrigin,
  requireRequestSession,
} from "../../../../server/auth/guards";
import { uploadDocumentFiles } from "../../../../server/documents/upload";

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

  const results = await uploadDocumentFiles(formData.getAll("files"), {
    allowDuplicate: formData.get("allowDuplicate") === "true",
  });
  if (results.length === 0) {
    return NextResponse.json(
      { message: "Choose at least one supported file." },
      { status: 400 },
    );
  }

  return NextResponse.json({ results });
}
