import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import {
  RequestGuardError,
  parseProtectedMutation,
  requireRequestSession,
} from "../src/server/auth/guards";
import { createSession } from "../src/lib/auth-session";
import { proxy } from "../src/proxy";
import { NextRequest } from "next/server";

const secret = "a-session-secret-that-is-longer-than-thirty-two-characters";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("protected request guards", () => {
  it("rejects unauthenticated API and document requests", async () => {
    vi.stubEnv("AUTH_SESSION_SECRET", secret);
    const apiRequest = new Request("https://app.example/api/documents");
    const documentRequest = new Request("https://app.example/documents/123");

    await expect(requireRequestSession(apiRequest)).rejects.toMatchObject({
      status: 401,
    } satisfies Partial<RequestGuardError>);
    await expect(requireRequestSession(documentRequest)).rejects.toMatchObject({
      status: 401,
    } satisfies Partial<RequestGuardError>);
  });

  it("requires an authenticated same-origin POST with valid input", async () => {
    vi.stubEnv("AUTH_SESSION_SECRET", secret);
    const session = await createSession(secret);
    const schema = z.object({ documentId: z.string().uuid() });
    const request = new Request("https://app.example/api/documents", {
      body: JSON.stringify({
        documentId: "de305d54-75b4-431b-adb2-eb6b9e546013",
      }),
      headers: {
        cookie: `my-business-session=${session.token}`,
        "content-type": "application/json",
        origin: "https://app.example",
      },
      method: "POST",
    });

    await expect(
      parseProtectedMutation(request, schema),
    ).resolves.toMatchObject({
      input: { documentId: "de305d54-75b4-431b-adb2-eb6b9e546013" },
    });

    await expect(
      parseProtectedMutation(
        new Request("https://app.example/api/documents", { method: "GET" }),
        schema,
      ),
    ).rejects.toMatchObject({
      status: 405,
    } satisfies Partial<RequestGuardError>);
    await expect(
      parseProtectedMutation(
        new Request("https://app.example/api/documents", {
          headers: { origin: "https://attacker.example" },
          method: "POST",
        }),
        schema,
      ),
    ).rejects.toMatchObject({
      status: 403,
    } satisfies Partial<RequestGuardError>);
  });
});

describe("proxy protection", () => {
  it("redirects direct protected-page requests and allows a valid session", async () => {
    vi.stubEnv("AUTH_SESSION_SECRET", secret);
    const unauthenticatedResponse = await proxy(
      new NextRequest("https://app.example/documents"),
    );
    const session = await createSession(secret);
    const authenticatedResponse = await proxy(
      new NextRequest("https://app.example/documents", {
        headers: { cookie: `my-business-session=${session.token}` },
      }),
    );

    expect(unauthenticatedResponse.headers.get("location")).toBe(
      "https://app.example/login",
    );
    expect(authenticatedResponse.headers.get("location")).toBeNull();
  });
});
