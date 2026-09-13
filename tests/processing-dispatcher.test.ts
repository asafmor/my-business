import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

const nextServer = vi.hoisted(() => ({ after: vi.fn() }));
const background = vi.hoisted(() => ({
  getBackgroundProcessingService: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => nextServer);
vi.mock(
  "../src/server/documents/background-processing-runtime",
  () => background,
);

import { dispatchDueDocumentProcessing } from "../src/server/documents/processing-dispatcher";

describe("post-response processing dispatch", () => {
  it("schedules the durable executor through Next.js after", async () => {
    const service = { runDueTasks: vi.fn().mockResolvedValue(1) };
    background.getBackgroundProcessingService.mockReturnValue(service);

    dispatchDueDocumentProcessing();

    expect(nextServer.after).toHaveBeenCalledOnce();
    const callback = nextServer.after.mock.calls[0]?.[0] as () => Promise<void>;
    await callback();
    expect(service.runDueTasks).toHaveBeenCalledOnce();
  });

  it("has no Vercel cron configuration", async () => {
    const config = JSON.parse(
      await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
    ) as { crons?: unknown };

    expect(config.crons).toBeUndefined();
  });
});
