import { NextResponse } from "next/server";

import {
  RequestGuardError,
  requireRequestSession,
} from "../../server/auth/guards";
import { uploadDocumentFiles } from "../../server/documents/upload";
import type { UploadedFileResult } from "../../server/documents/upload";

/*
 * Android's share sheet POSTs here as a top-level navigation. Two consequences
 * shape this handler:
 *
 * - No same-origin check. The navigation is browser-initiated, so there is no
 *   initiator origin to assert against. CSRF cover comes from the session
 *   cookie being SameSite=Lax: a *page* that forged this POST would be a
 *   cross-site unsafe-method navigation and Chromium would strip the cookie,
 *   leaving the request unauthenticated. The share sheet's own navigation has
 *   no initiator, which Chromium treats as same-site, so the cookie is sent.
 * - The reply is a 303 so the browser follows it with a GET; a refresh of the
 *   landing page must not re-run the upload.
 */
function seeOther(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

function destination(results: UploadedFileResult[]): string {
  const stored = results.filter(
    (result) => result.status === "uploaded" || result.status === "duplicate",
  );

  if (stored.length !== results.length || stored.length === 0) {
    // Something was refused. Say so on the upload page rather than dropping
    // the rejected files without a word.
    return `/upload?added=${stored.length}&failed=${results.length - stored.length}`;
  }

  if (stored.length === 1) {
    const only = stored[0]!;
    return `/documents/${only.status === "uploaded" ? only.documentId : only.existingDocumentId}`;
  }

  return "/documents";
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireRequestSession(request);
  } catch (error) {
    if (error instanceof RequestGuardError) {
      // No session, or an expired one. The files cannot be parked anywhere
      // without an authenticated owner, so ask for a login and let the user
      // share again.
      return seeOther(request, "/login");
    }
    throw error;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return seeOther(request, "/upload?added=0&failed=0");
  }

  const results = await uploadDocumentFiles(formData.getAll("files"), {
    allowDuplicate: false,
  });
  return seeOther(request, destination(results));
}
