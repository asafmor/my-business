import { afterEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => {
  class RequestGuardError extends Error {
    constructor(public readonly status: 400 | 401 | 403 | 405) {
      super("Request rejected.");
    }
  }

  return { RequestGuardError, requireRequestSession: vi.fn() };
});
const upload = vi.hoisted(() => ({ uploadDocumentFiles: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../src/server/auth/guards", () => guards);
vi.mock("../src/server/documents/upload", () => upload);

import { POST } from "../src/app/share-target/route";

afterEach(() => {
  guards.requireRequestSession.mockReset();
  upload.uploadDocumentFiles.mockReset();
});

function shareRequest(fileNames: string[] = ["receipt.jpg"]): Request {
  const formData = new FormData();
  for (const name of fileNames) {
    formData.append(
      "files",
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], name, {
        type: "image/jpeg",
      }),
    );
  }

  return new Request("https://app.example/share-target", {
    body: formData,
    method: "POST",
  });
}

function location(response: Response): string {
  const url = new URL(response.headers.get("location") ?? "");
  return `${url.pathname}${url.search}`;
}

const uploaded = (documentId: string) => ({
  documentId,
  fileName: "receipt.jpg",
  mimeType: "image/jpeg",
  sha256: "a".repeat(64),
  sizeBytes: 4,
  status: "uploaded",
});

describe("share target route", () => {
  it("sends an unauthenticated share to the login page without ingesting", async () => {
    guards.requireRequestSession.mockRejectedValueOnce(
      new guards.RequestGuardError(401),
    );

    const response = await POST(shareRequest());

    expect(response.status).toBe(303);
    expect(location(response)).toBe("/login");
    expect(upload.uploadDocumentFiles).not.toHaveBeenCalled();
  });

  it("takes a single shared file to its document for review", async () => {
    upload.uploadDocumentFiles.mockResolvedValue([
      uploaded("de305d54-75b4-431b-adb2-eb6b9e546013"),
    ]);

    const response = await POST(shareRequest());

    expect(response.status).toBe(303);
    expect(location(response)).toBe(
      "/documents/de305d54-75b4-431b-adb2-eb6b9e546013",
    );
    expect(upload.uploadDocumentFiles).toHaveBeenCalledWith(
      [expect.any(File)],
      { allowDuplicate: false },
    );
  });

  it("takes a duplicate share to the document it already has", async () => {
    upload.uploadDocumentFiles.mockResolvedValue([
      {
        existingDocumentId: "de305d54-75b4-431b-adb2-eb6b9e546013",
        fileName: "receipt.jpg",
        sha256: "b".repeat(64),
        status: "duplicate",
      },
    ]);

    const response = await POST(shareRequest());

    expect(location(response)).toBe(
      "/documents/de305d54-75b4-431b-adb2-eb6b9e546013",
    );
  });

  it("takes a clean multi-file share to the documents list", async () => {
    upload.uploadDocumentFiles.mockResolvedValue([
      uploaded("de305d54-75b4-431b-adb2-eb6b9e546013"),
      uploaded("3f333df6-90a4-4fda-8dd3-9485d27cee36"),
    ]);

    const response = await POST(shareRequest(["a.jpg", "b.jpg"]));

    expect(location(response)).toBe("/documents");
  });

  it("reports refused files instead of dropping them silently", async () => {
    upload.uploadDocumentFiles.mockResolvedValue([
      uploaded("de305d54-75b4-431b-adb2-eb6b9e546013"),
      { fileName: "notes.txt", message: "nope", status: "rejected" },
    ]);

    const response = await POST(shareRequest(["a.jpg", "notes.txt"]));

    expect(location(response)).toBe("/upload?added=1&failed=1");
  });

  it("reports a share that carried nothing usable", async () => {
    upload.uploadDocumentFiles.mockResolvedValue([]);

    const response = await POST(shareRequest([]));

    expect(location(response)).toBe("/upload?added=0&failed=0");
  });
});
