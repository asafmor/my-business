import { describe, expect, it } from "vitest";

import {
  createSession,
  sessionLifetimeSeconds,
  validateSession,
} from "../src/lib/auth-session";

const secret = "a-session-secret-that-is-longer-than-thirty-two-characters";
const issuedAt = new Date("2026-09-13T12:00:00.000Z");

async function createExtendedLifetimeToken(): Promise<string> {
  const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1_000);
  const payload = Buffer.from(
    JSON.stringify({
      exp: issuedAtSeconds + sessionLifetimeSeconds + 1,
      iat: issuedAtSeconds,
      jti: "a".repeat(32),
      v: 1,
    }),
  ).toString("base64url");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );

  return `${payload}.${Buffer.from(signature).toString("base64url")}`;
}

describe("signed sessions", () => {
  it("accepts a valid signed session without exposing configuration secrets", async () => {
    const session = await createSession(secret, issuedAt);

    expect(await validateSession(session.token, secret, issuedAt)).toEqual({
      expiresAt: new Date(issuedAt.getTime() + sessionLifetimeSeconds * 1_000),
    });
    expect(session.token).not.toContain(secret);
  });

  it("rejects expired and tampered sessions", async () => {
    const session = await createSession(secret, issuedAt);
    const [payload, signature] = session.token.split(".");
    if (!payload || !signature) {
      throw new Error("Expected a signed session token.");
    }
    const tamperedToken = `${payload}.${
      signature.startsWith("a") ? "b" : "a"
    }${signature.slice(1)}`;

    expect(
      await validateSession(
        session.token,
        secret,
        new Date(issuedAt.getTime() + sessionLifetimeSeconds * 1_000),
      ),
    ).toBeNull();
    expect(await validateSession(tamperedToken, secret, issuedAt)).toBeNull();
    expect(
      await validateSession(`a.${signature}`, secret, issuedAt),
    ).toBeNull();
  });

  it("rejects a correctly signed session exceeding the documented lifetime", async () => {
    expect(
      await validateSession(
        await createExtendedLifetimeToken(),
        secret,
        issuedAt,
      ),
    ).toBeNull();
  });
});
