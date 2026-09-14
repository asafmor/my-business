import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  authenticateLogin,
  destroySessionCookie,
  setSessionCookie,
} from "../src/server/auth/service";
import { createLoginRateLimit } from "../src/server/auth/rate-limit";

const environment = {
  AUTH_PASSWORD_HASH: "",
  AUTH_SESSION_SECRET:
    "a-session-secret-that-is-longer-than-thirty-two-characters",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("login authentication", () => {
  it("returns the same generic failure for a bad password", async () => {
    const passwordHash = await bcrypt.hash("correct horse battery staple", 4);
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await authenticateLogin(
      "wrong password",
      new Headers({ "x-vercel-forwarded-for": "bad-password-test" }),
      { ...environment, AUTH_PASSWORD_HASH: passwordHash },
      new Date("2026-09-13T12:00:00.000Z"),
    );

    expect(result).toEqual({ success: false });
    expect(log).toHaveBeenCalledWith(
      expect.not.stringContaining("wrong password"),
    );
  });

  it("does not log a rate-limited rejection as a failed login", async () => {
    const passwordHash = await bcrypt.hash("correct horse battery staple", 4);
    const headers = new Headers({ "x-vercel-forwarded-for": "limited-test" });
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await authenticateLogin(
        "wrong password",
        headers,
        { ...environment, AUTH_PASSWORD_HASH: passwordHash },
        new Date("2026-09-13T12:00:00.000Z"),
      );
    }

    log.mockClear();
    expect(
      await authenticateLogin(
        "wrong password",
        headers,
        { ...environment, AUTH_PASSWORD_HASH: passwordHash },
        new Date("2026-09-13T12:00:00.000Z"),
      ),
    ).toEqual({ success: false });
    expect(log).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("security.login_rate_limited"),
    );
  });

  it("creates a secure cookie and expires it on logout", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const passwordHash = await bcrypt.hash("correct horse battery staple", 4);
    const result = await authenticateLogin(
      "correct horse battery staple",
      new Headers({ "x-vercel-forwarded-for": "cookie-test" }),
      { ...environment, AUTH_PASSWORD_HASH: passwordHash },
      new Date("2026-09-13T12:00:00.000Z"),
    );
    const set = vi.fn();
    const store = { get: () => undefined, set };

    if (!result.success) {
      throw new Error("Expected a successful login.");
    }

    setSessionCookie(store, result.session);
    expect(set).toHaveBeenLastCalledWith(
      "my-business-session",
      result.session.token,
      expect.objectContaining({
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: true,
      }),
    );

    destroySessionCookie(store);
    expect(set).toHaveBeenLastCalledWith(
      "my-business-session",
      "",
      expect.objectContaining({ expires: new Date(0), maxAge: 0 }),
    );
  });
});

describe("login rate limiting", () => {
  it("admits only the configured burst before lockout", () => {
    const limiter = createLoginRateLimit({
      lockoutMilliseconds: 100,
      maximumAttempts: 3,
      windowMilliseconds: 1_000,
    });

    const admissions = Array.from({ length: 10 }, () =>
      limiter.admit("client", 0),
    );

    expect(admissions.filter(Boolean)).toHaveLength(3);
    expect(limiter.admit("client", 1)).toBe(false);
  });

  it("resets after a successful login and permits attempts after lockout expiry", () => {
    const limiter = createLoginRateLimit({
      lockoutMilliseconds: 100,
      maximumAttempts: 2,
      windowMilliseconds: 1_000,
    });

    expect(limiter.admit("successful-client", 0)).toBe(true);
    expect(limiter.admit("successful-client", 1)).toBe(true);
    expect(limiter.admit("successful-client", 2)).toBe(false);
    limiter.reset("successful-client");
    expect(limiter.admit("successful-client", 3)).toBe(true);

    expect(limiter.admit("expired-client", 0)).toBe(true);
    expect(limiter.admit("expired-client", 1)).toBe(true);
    expect(limiter.admit("expired-client", 2)).toBe(false);
    expect(limiter.admit("expired-client", 102)).toBe(true);
  });
});
