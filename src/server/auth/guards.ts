import "server-only";

import type { z } from "zod";

import { sessionCookieName, validateSession } from "../../lib/auth-session";
import type { Session } from "../../lib/auth-session";

import { getSessionSecret, requireSession } from "./service";

export class RequestGuardError extends Error {
  constructor(public readonly status: 400 | 401 | 403 | 405) {
    super("Request rejected.");
  }
}

function getCookieValue(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [name, ...value] = cookie.trim().split("=");
    if (name === sessionCookieName) {
      try {
        return decodeURIComponent(value.join("="));
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

export async function requireRequestSession(
  request: Request,
): Promise<Session> {
  const secret = getSessionSecret();
  const session = await validateSession(
    getCookieValue(request.headers.get("cookie")),
    secret ?? undefined,
  );

  if (!session) {
    throw new RequestGuardError(401);
  }

  return session;
}

export function assertPostFromSameOrigin(request: Request): void {
  if (request.method !== "POST") {
    throw new RequestGuardError(405);
  }

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new RequestGuardError(403);
  }
}

// Future storage, report, and AI handlers should call this before any data access.
export async function requireProtectedOperation(): Promise<Session> {
  return requireSession();
}

export async function parseProtectedMutation<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ input: T; session: Session }> {
  assertPostFromSameOrigin(request);
  const session = await requireRequestSession(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new RequestGuardError(400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new RequestGuardError(400);
  }

  return { input: parsed.data, session };
}
