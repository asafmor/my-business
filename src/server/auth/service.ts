import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  createSession,
  sessionCookieName,
  validateSession,
} from "../../lib/auth-session";
import type { CreatedSession, Session } from "../../lib/auth-session";

import { verifyPassword } from "./password";
import { loginRateLimit } from "./rate-limit";
import { logSecurityEvent } from "./security-events";

type Environment = Record<string, string | undefined>;

type CookieStore = {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    options: {
      expires: Date;
      httpOnly: true;
      maxAge?: number;
      path: "/";
      sameSite: "lax";
      secure: boolean;
    },
  ): void;
};

type AuthConfiguration = {
  passwordHash: string;
  sessionSecret: string;
};

export type LoginResult =
  { session: CreatedSession; success: true } | { success: false };

export function getSessionSecret(
  environment: Environment = process.env,
): string | null {
  const secret = environment.AUTH_SESSION_SECRET;

  return secret && secret.length >= 32 ? secret : null;
}

function getAuthConfiguration(
  environment: Environment,
): AuthConfiguration | null {
  const sessionSecret = getSessionSecret(environment);
  const passwordHash = environment.AUTH_PASSWORD_HASH;

  if (!sessionSecret || !passwordHash) {
    return null;
  }

  return { passwordHash, sessionSecret };
}

function getClientIdentifier(headers: Headers): string {
  return (
    headers.get("x-vercel-forwarded-for") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  ).slice(0, 200);
}

function sessionCookieOptions(expires: Date) {
  return {
    expires,
    httpOnly: true as const,
    path: "/" as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function setSessionCookie(
  store: CookieStore,
  session: CreatedSession,
): void {
  store.set(
    sessionCookieName,
    session.token,
    sessionCookieOptions(session.expiresAt),
  );
}

export function destroySessionCookie(store: CookieStore): void {
  store.set(sessionCookieName, "", {
    ...sessionCookieOptions(new Date(0)),
    maxAge: 0,
  });
}

export async function authenticateLogin(
  password: string,
  headers: Headers,
  environment: Environment = process.env,
  now = new Date(),
): Promise<LoginResult> {
  const clientId = getClientIdentifier(headers);
  if (!loginRateLimit.admit(clientId, now.getTime())) {
    logSecurityEvent("login_rate_limited");
    return { success: false };
  }

  const configuration = getAuthConfiguration(environment);
  const passwordIsValid = configuration
    ? await verifyPassword(password, configuration.passwordHash)
    : false;

  if (!passwordIsValid || !configuration) {
    logSecurityEvent("login_failed");
    return { success: false };
  }

  loginRateLimit.reset(clientId);
  return {
    success: true,
    session: await createSession(configuration.sessionSecret, now),
  };
}

export async function getSession(): Promise<Session | null> {
  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  const store = (await cookies()) as CookieStore;
  return validateSession(store.get(sessionCookieName)?.value, secret);
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function logout(): Promise<void> {
  await requireSession();
  destroySessionCookie((await cookies()) as CookieStore);
}
