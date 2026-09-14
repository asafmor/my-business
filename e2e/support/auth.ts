import type { BrowserContext } from "@playwright/test";

import { createSession, sessionCookieName } from "../../src/lib/auth-session";

/**
 * Mints a signed session cookie directly (same mechanism as
 * tests/auth-session.test.ts) instead of driving the login form, so flows
 * that need an authenticated browser don't depend on knowing the real
 * Development login password.
 */
export async function signIn(
  context: BrowserContext,
  baseURL: string,
  options: { expired?: boolean } = {},
): Promise<void> {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) throw new Error("AUTH_SESSION_SECRET is required to sign in.");

  const issuedAt = options.expired
    ? new Date(Date.now() - 1000 * 60 * 60 * 24) // 24h ago: already expired
    : new Date();
  const session = await createSession(secret, issuedAt);

  await context.addCookies([
    {
      domain: new URL(baseURL).hostname,
      httpOnly: true,
      name: sessionCookieName,
      path: "/",
      sameSite: "Lax",
      value: session.token,
    },
  ]);
}
