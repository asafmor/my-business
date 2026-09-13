import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireProtectedOperation: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../src/server/auth/guards", () => auth);

import { documentOriginalObjectKey } from "../src/server/storage/object-keys";
import { createPrivateReadUrl } from "../src/server/storage/private-access";

const key = documentOriginalObjectKey("de305d54-75b4-431b-adb2-eb6b9e546013");

afterEach(() => {
  auth.requireProtectedOperation.mockReset();
});

describe("private storage access", () => {
  it("does not authorize or sign a URL without a session", async () => {
    auth.requireProtectedOperation.mockRejectedValue(new Error("redirect"));
    const authorize = vi.fn();
    const createSignedReadUrl = vi.fn();

    await expect(
      createPrivateReadUrl({ createSignedReadUrl } as never, {
        authorize,
        key,
      }),
    ).rejects.toThrow("redirect");
    expect(authorize).not.toHaveBeenCalled();
    expect(createSignedReadUrl).not.toHaveBeenCalled();
  });

  it("authorizes the requested document or report before creating its signed URL", async () => {
    const session = { expiresAt: new Date("2026-09-13T20:00:00.000Z") };
    auth.requireProtectedOperation.mockResolvedValue(session);
    const authorize = vi.fn();
    const createSignedReadUrl = vi.fn().mockResolvedValue({
      expiresAt: new Date("2026-09-13T12:01:00.000Z"),
      url: "https://signed.example/object",
    });

    await expect(
      createPrivateReadUrl({ createSignedReadUrl } as never, {
        authorize,
        key,
      }),
    ).resolves.toMatchObject({ url: "https://signed.example/object" });
    expect(authorize).toHaveBeenCalledWith(session);
    expect(createSignedReadUrl).toHaveBeenCalledWith(key);
  });
});
