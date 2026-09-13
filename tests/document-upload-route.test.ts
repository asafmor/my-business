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
const upload = vi.hoisted(() => ({
  getDocumentUploadService: vi.fn(),
}));
const dispatcher = vi.hoisted(() => ({
  dispatchDueDocumentProcessing: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../src/server/auth/guards", () => guards);
vi.mock("../src/server/documents/upload", () => upload);
vi.mock("../src/server/documents/processing-dispatcher", () => dispatcher);

import { POST } from "../src/app/api/documents/upload/route";
import { FileValidationError } from "../src/server/storage/file-validation";

afterEach(() => {
  guards.assertPostFromSameOrigin.mockReset();
  guards.requireRequestSession.mockReset();
  upload.getDocumentUploadService.mockReset();
  dispatcher.dispatchDueDocumentProcessing.mockReset();
});

function uploadRequest(formData: FormData): Request {
  return new Request("https://app.example/api/documents/upload", {
    body: formData,
    headers: { origin: "https://app.example" },
    method: "POST",
  });
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
  });

  it("accepts multiple files and returns a result for every file", async () => {
    const service = {
      upload: vi
        .fn()
        .mockResolvedValueOnce({
          documentId: "de305d54-75b4-431b-adb2-eb6b9e546013",
          mimeType: "image/jpeg",
          sha256: "a".repeat(64),
          sizeBytes: 4,
          status: "uploaded",
        })
        .mockResolvedValueOnce({
          existingDocumentId: "de305d54-75b4-431b-adb2-eb6b9e546013",
          sha256: "b".repeat(64),
          status: "duplicate",
        }),
    };
    upload.getDocumentUploadService.mockReturnValue(service);
    const formData = new FormData();
    formData.append(
      "files",
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "receipt.jpg", {
        type: "image/jpeg",
      }),
    );
    formData.append(
      "files",
      new File([new TextEncoder().encode("%PDF-1.7")], "invoice.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await POST(uploadRequest(formData));

    expect(guards.assertPostFromSameOrigin).toHaveBeenCalledOnce();
    expect(guards.requireRequestSession).toHaveBeenCalledOnce();
    expect(service.upload).toHaveBeenCalledTimes(2);
    expect(dispatcher.dispatchDueDocumentProcessing).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      results: [
        { fileName: "receipt.jpg", status: "uploaded" },
        { fileName: "invoice.pdf", status: "duplicate" },
      ],
    });
  });

  it("returns an individual rejection without turning a bad file into a success", async () => {
    upload.getDocumentUploadService.mockReturnValue({
      upload: vi
        .fn()
        .mockRejectedValue(new FileValidationError("Unsupported file.")),
    });
    const formData = new FormData();
    formData.append(
      "files",
      new File([new TextEncoder().encode("not a file")], "notes.txt", {
        type: "text/plain",
      }),
    );

    const response = await POST(uploadRequest(formData));

    await expect(response.json()).resolves.toEqual({
      results: [
        {
          fileName: "notes.txt",
          message: "Unsupported file.",
          status: "rejected",
        },
      ],
    });
    expect(dispatcher.dispatchDueDocumentProcessing).not.toHaveBeenCalled();
  });
});
