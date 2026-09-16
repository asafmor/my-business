import { NextResponse, type NextRequest } from "next/server";

import { sessionCookieName, validateSession } from "./lib/auth-session";

export async function proxy(request: NextRequest) {
  const session = await validateSession(
    request.cookies.get(sessionCookieName)?.value,
    process.env.AUTH_SESSION_SECRET,
  );

  if (request.nextUrl.pathname === "/login") {
    return session
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /*
   * The manifest and its icons must answer without a session: Chromium
   * fetches the manifest without credentials, and an install check that gets
   * a redirect to /login sees no manifest at all. `/share-target` is left out
   * for a different reason — it guards itself like the API routes do, so the
   * share POST reaches a handler that can answer with a 303 instead of the
   * method-preserving redirect this proxy would issue.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|share-target).*)",
  ],
};
