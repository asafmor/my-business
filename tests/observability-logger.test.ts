import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { logError, logWarning } from "../src/server/observability/logger";

describe("logError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a structured JSON line via console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logError("upload.failed", new Error("disk full"), { fileName: "a.pdf" });

    expect(spy).toHaveBeenCalledOnce();
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line).toMatchObject({
      error: "disk full",
      event: "upload.failed",
      fileName: "a.pdf",
    });
    expect(typeof line.timestamp).toBe("string");
  });

  it("redacts secrets found in the error message and fields", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logError(
      "database.failed",
      new Error("postgres://user:hunter2@host:5432/db unreachable"),
      { detail: "Authorization: Bearer sk-abc123" },
    );

    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.error).toBe("postgres://[redacted]@host:5432/db unreachable");
    expect(line.detail).toBe("Authorization: [redacted]");
  });

  it("stringifies non-Error values", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logError("r2.write_failed", "boom");

    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.error).toBe("boom");
  });
});

describe("logWarning", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a structured JSON line via console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logWarning("processing.retry_exhausted", { documentId: "doc-1" });

    expect(spy).toHaveBeenCalledOnce();
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line).toMatchObject({
      documentId: "doc-1",
      event: "processing.retry_exhausted",
    });
  });
});
