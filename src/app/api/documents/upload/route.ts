import { NextResponse } from "next/server";

import {
  RequestGuardError,
  assertPostFromSameOrigin,
  requireRequestSession,
} from "../../../../server/auth/guards";
import {
  uploadDocumentCopy,
  uploadDocumentFiles,
} from "../../../../server/documents/upload";

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

  // A shared upload's bytes never reached the browser, so "Upload anyway" asks
  // for a copy of what is already stored instead of re-sending a file.
  const copyOf = formData.get("copyOf");
  if (typeof copyOf === "string") {
    const fileName = formData.get("fileName");
    const result = await uploadDocumentCopy(
      copyOf,
      typeof fileName === "string" && fileName ? fileName : "Shared document",
    );
    return NextResponse.json({ results: [result] });
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
