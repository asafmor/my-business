export const sessionCookieName = "my-business-session";
export const sessionLifetimeSeconds = 60 * 60 * 8;

export type Session = {
  expiresAt: Date;
};

export type CreatedSession = Session & {
  token: string;
};

type SessionPayload = {
  exp: number;
  iat: number;
  jti: string;
  v: 1;
};

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value: string): Uint8Array | null {
  if (value.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );

    return bytes;
  } catch {
    return null;
  }
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(value: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getSigningKey(secret),
    new TextEncoder().encode(value),
  );
  let binary = "";

  for (const byte of new Uint8Array(signature)) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function createSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Partial<SessionPayload>;
  return (
    payload.v === 1 &&
    typeof payload.iat === "number" &&
    Number.isSafeInteger(payload.iat) &&
    typeof payload.exp === "number" &&
    Number.isSafeInteger(payload.exp) &&
    typeof payload.jti === "string" &&
    /^[A-Za-z0-9_-]{32}$/.test(payload.jti) &&
    payload.exp > payload.iat
  );
}

export async function createSession(
  secret: string,
  now = new Date(),
): Promise<CreatedSession> {
  const issuedAt = Math.floor(now.getTime() / 1_000);
  const expiresAt = issuedAt + sessionLifetimeSeconds;
  const payload: SessionPayload = {
    v: 1,
    iat: issuedAt,
    exp: expiresAt,
    jti: createSessionId(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(encodedPayload, secret);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(expiresAt * 1_000),
  };
}

export async function validateSession(
  token: string | undefined,
  secret: string | undefined,
  now = new Date(),
): Promise<Session | null> {
  if (!token || !secret || secret.length < 32) {
    return null;
  }

  const [encodedPayload, signature, ...extraParts] = token.split(".");
  if (!encodedPayload || !signature || extraParts.length > 0) {
    return null;
  }

  const decodedPayload = base64UrlDecode(encodedPayload);
  const decodedSignature = base64UrlDecode(signature);
  if (!decodedPayload || !decodedSignature) {
    return null;
  }

  try {
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      await getSigningKey(secret),
      copyToArrayBuffer(decodedSignature),
      new TextEncoder().encode(encodedPayload),
    );
    const payload: unknown = JSON.parse(
      new TextDecoder().decode(decodedPayload),
    );

    if (!validSignature || !isSessionPayload(payload)) {
      return null;
    }

    if (payload.exp - payload.iat > sessionLifetimeSeconds) {
      return null;
    }

    const currentTime = Math.floor(now.getTime() / 1_000);
    if (payload.exp <= currentTime) {
      return null;
    }

    return { expiresAt: new Date(payload.exp * 1_000) };
  } catch {
    return null;
  }
}
