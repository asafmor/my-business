import { afterEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => {
  class RequestGuardError extends Error {
    constructor(public readonly status: 400 | 401 | 403 | 405) {
      super("Request rejected.");
    }
  }

  return { RequestGuardError, parseProtectedMutation: vi.fn() };
});
const background = vi.hoisted(() => ({
  getBackgroundProcessingService: vi.fn(),
}));
const dispatcher = vi.hoisted(() => ({
  dispatchDueDocumentProcessing: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../src/server/auth/guards", () => guards);
vi.mock(
  "../src/server/documents/background-processing-runtime",
  () => background,
);
vi.mock("../src/server/documents/processing-dispatcher", () => dispatcher);

import { POST as retry } from "../src/app/api/documents/processing/retry/route";
import { POST as status } from "../src/app/api/documents/processing/status/route";

afterEach(() => {
  guards.parseProtectedMutation.mockReset();
  background.getBackgroundProcessingService.mockReset();
  dispatcher.dispatchDueDocumentProcessing.mockReset();
});

describe("document processing routes", () => {
  it("does not expose status polling without the shared auth and origin guard", async () => {
    guards.parseProtectedMutation.mockRejectedValue(
      new guards.RequestGuardError(403),
    );

    const response = await status(
      new Request("https://app.example/api/documents/processing/status"),
    );

    expect(response.status).toBe(403);
    expect(background.getBackgroundProcessingService).not.toHaveBeenCalled();
    expect(dispatcher.dispatchDueDocumentProcessing).not.toHaveBeenCalled();
  });

  it("does not queue a retry without the shared auth and origin guard", async () => {
    guards.parseProtectedMutation.mockRejectedValue(
      new guards.RequestGuardError(401),
    );

    const response = await retry(
      new Request("https://app.example/api/documents/processing/retry"),
    );

    expect(response.status).toBe(401);
    expect(background.getBackgroundProcessingService).not.toHaveBeenCalled();
    expect(dispatcher.dispatchDueDocumentProcessing).not.toHaveBeenCalled();
  });

  it("makes repeated authorized retry requests safe", async () => {
    guards.parseProtectedMutation.mockResolvedValue({
      input: { documentId: "de305d54-75b4-431b-adb2-eb6b9e546013" },
    });
    const service = {
      retry: vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false),
    };
    background.getBackgroundProcessingService.mockReturnValue(service);
    const request = new Request(
      "https://app.example/api/documents/processing/retry",
      {
        method: "POST",
      },
    );

    await expect((await retry(request)).json()).resolves.toEqual({
      queued: true,
    });
    await expect((await retry(request)).json()).resolves.toEqual({
      queued: false,
    });
    expect(service.retry).toHaveBeenCalledTimes(2);
    expect(dispatcher.dispatchDueDocumentProcessing).toHaveBeenCalledOnce();
  });

  it("schedules due work after an authorized status refresh", async () => {
    guards.parseProtectedMutation.mockResolvedValue({
      input: { documentIds: ["de305d54-75b4-431b-adb2-eb6b9e546013"] },
    });
    const service = { getDocumentStatuses: vi.fn().mockResolvedValue([]) };
    background.getBackgroundProcessingService.mockReturnValue(service);

    await expect(
      (
        await status(
          new Request("https://app.example/api/documents/processing/status"),
        )
      ).json(),
    ).resolves.toEqual({ documents: [] });

    expect(service.getDocumentStatuses).toHaveBeenCalledOnce();
    expect(dispatcher.dispatchDueDocumentProcessing).toHaveBeenCalledOnce();
  });
});
