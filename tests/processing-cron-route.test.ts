import { afterEach, describe, expect, it, vi } from "vitest";

const background = vi.hoisted(() => ({
  getBackgroundProcessingService: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock(
  "../src/server/documents/background-processing-runtime",
  () => background,
);

import { GET } from "../src/app/api/cron/process-documents/route";

afterEach(() => {
  vi.unstubAllEnvs();
  background.getBackgroundProcessingService.mockReset();
});

describe("processing cron route", () => {
  it("rejects unauthenticated cron requests", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");

    const response = await GET(
      new Request("https://app.example/api/cron/process-documents"),
    );

    expect(response.status).toBe(401);
    expect(background.getBackgroundProcessingService).not.toHaveBeenCalled();
  });

  it("runs only with Vercel's configured bearer secret", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    const service = { runDueTasks: vi.fn().mockResolvedValue(2) };
    background.getBackgroundProcessingService.mockReturnValue(service);

    const response = await GET(
      new Request("https://app.example/api/cron/process-documents", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    await expect(response.json()).resolves.toEqual({ processed: 2 });
    expect(service.runDueTasks).toHaveBeenCalledOnce();
  });
});
