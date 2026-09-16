import { afterEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => {
  class RequestGuardError extends Error {
    constructor(public readonly status: 400 | 401 | 403 | 405) {
      super("Request rejected.");
    }
  }

  return {
    RequestGuardError,
    assertPostFromSameOrigin: vi.fn(),
    requireRequestSession: vi.fn(),
  };
});
const upload = vi.hoisted(() => ({ uploadDocumentFiles: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../src/server/auth/guards", () => guards);
vi.mock("../src/server/documents/upload", () => upload);

import { POST } from "../src/app/api/documents/upload/route";

afterEach(() => {
  guards.assertPostFromSameOrigin.mockReset();
  guards.requireRequestSession.mockReset();
  upload.uploadDocumentFiles.mockReset();
});

function uploadRequest(formData: FormData): Request {
  return new Request("https://app.example/api/documents/upload", {
    body: formData,
    headers: { origin: "https://app.example" },
    method: "POST",
  });
}

function formWith(...names: string[]): FormData {
  const formData = new FormData();
  for (const name of names) {
    formData.append(
      "files",
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], name, {
        type: "image/jpeg",
      }),
    );
  }
  return formData;
}

describe("document upload route", () => {
  it("requires the shared same-origin and session guards before parsing files", async () => {
    guards.assertPostFromSameOrigin.mockImplementationOnce(() => {
      throw new guards.RequestGuardError(403);
    });

    const response = await POST(
      new Request("https://app.example/api/documents/upload", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    expect(guards.requireRequestSession).not.toHaveBeenCalled();
    expect(upload.uploadDocumentFiles).not.toHaveBeenCalled();
  });

  it("hands every file to the shared ingestion path and returns its results", async () => {
    const results = [
      { fileName: "receipt.jpg", status: "uploaded" },
      { fileName: "invoice.pdf", status: "duplicate" },
    ];
    upload.uploadDocumentFiles.mockResolvedValue(results);
    const formData = formWith("receipt.jpg", "invoice.pdf");
    formData.append("allowDuplicate", "true");

    const response = await POST(uploadRequest(formData));

    expect(guards.assertPostFromSameOrigin).toHaveBeenCalledOnce();
    expect(guards.requireRequestSession).toHaveBeenCalledOnce();
    expect(upload.uploadDocumentFiles).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(File)]),
      { allowDuplicate: true },
    );
    await expect(response.json()).resolves.toEqual({ results });
  });

  it("answers 400 when nothing usable was submitted", async () => {
    upload.uploadDocumentFiles.mockResolvedValue([]);

    const response = await POST(uploadRequest(new FormData()));

    expect(response.status).toBe(400);
  });
});
