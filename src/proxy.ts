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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
