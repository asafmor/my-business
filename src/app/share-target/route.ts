import { NextResponse } from "next/server";

import {
  RequestGuardError,
  requireRequestSession,
} from "../../server/auth/guards";
import { uploadDocumentFiles } from "../../server/documents/upload";
import type { UploadedFileResult } from "../../server/documents/upload";
import { logError, logWarning } from "../../server/observability/logger";

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

  if (stored.length !== results.length) {
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

/*
 * Shapes only — names, types and sizes, never contents. A share that arrives
 * with nothing usable is invisible from this side otherwise, and the device
 * that produced it is not one we can attach a debugger to.
 */
function describeFields(formData: FormData): string {
  const fields = [...formData.entries()].map(([name, value]) =>
    typeof value === "string"
      ? `${name}:text(${value.length})`
      : `${name}:file(${value.type || "no-type"},${value.size}B)`,
  );
  return fields.length > 0 ? fields.join(" ") : "none";
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
  } catch (error) {
    logError("share_target.unreadable", error, {
      contentLength: request.headers.get("content-length"),
      contentType: request.headers.get("content-type"),
    });
    return seeOther(request, "/upload?share=unreadable");
  }

  /*
   * Every field, not just the declared `files` one. Which field name a shared
   * file lands in is Chrome's decision on the device, made by matching the
   * file's resolved MIME type against the manifest; when that match is off by
   * anything the file would otherwise vanish. Non-file entries are dropped
   * downstream, so sweeping them up here is free.
   */
  const results = await uploadDocumentFiles([...formData.values()], {
    allowDuplicate: false,
  });

  if (results.length === 0) {
    logWarning("share_target.no_files", {
      contentLength: request.headers.get("content-length"),
      contentType: request.headers.get("content-type"),
      fields: describeFields(formData),
    });
    return seeOther(request, "/upload?share=empty");
  }

  return seeOther(request, destination(results));
}
