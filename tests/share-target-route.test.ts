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
const logger = vi.hoisted(() => ({ logError: vi.fn(), logWarning: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../src/server/auth/guards", () => guards);
vi.mock("../src/server/documents/upload", () => upload);
vi.mock("../src/server/observability/logger", () => logger);

import { POST } from "../src/app/share-target/route";
import {
  decodeSharedUploads,
  type SharedUploadResult,
} from "../src/domain/documents/shared-upload";

afterEach(() => {
  guards.requireRequestSession.mockReset();
  upload.uploadDocumentFiles.mockReset();
  logger.logError.mockReset();
  logger.logWarning.mockReset();
});

function shareRequest(
  fileNames: string[] = ["receipt.jpg"],
  field = "files",
): Request {
  const formData = new FormData();
  for (const name of fileNames) {
    formData.append(
      field,
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

/* What the upload page will hand the tray, decoded back out of the redirect. */
function adopted(response: Response): SharedUploadResult[] {
  const url = new URL(response.headers.get("location") ?? "");
  return decodeSharedUploads(url.searchParams.getAll("shared"));
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

  it("hands a shared file to the upload page for the tray to adopt", async () => {
    upload.uploadDocumentFiles.mockResolvedValue([
      uploaded("de305d54-75b4-431b-adb2-eb6b9e546013"),
    ]);

    const response = await POST(shareRequest());

    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/upload",
    );
    expect(adopted(response)).toEqual([
      {
        documentId: "de305d54-75b4-431b-adb2-eb6b9e546013",
        fileName: "receipt.jpg",
        status: "uploaded",
      },
    ]);
    expect(upload.uploadDocumentFiles).toHaveBeenCalledWith(
      [expect.any(File)],
      { allowDuplicate: false },
    );
  });

  it("points a duplicate share at the document it already has", async () => {
    upload.uploadDocumentFiles.mockResolvedValue([
      {
        existingDocumentId: "de305d54-75b4-431b-adb2-eb6b9e546013",
        fileName: "receipt.jpg",
        sha256: "b".repeat(64),
        status: "duplicate",
      },
    ]);

    expect(adopted(await POST(shareRequest()))).toEqual([
      {
        documentId: "de305d54-75b4-431b-adb2-eb6b9e546013",
        fileName: "receipt.jpg",
        status: "duplicate",
      },
    ]);
  });

  it("carries every file of a multi-file share", async () => {
    upload.uploadDocumentFiles.mockResolvedValue([
      {
        ...uploaded("de305d54-75b4-431b-adb2-eb6b9e546013"),
        fileName: "a.jpg",
      },
      {
        ...uploaded("3f333df6-90a4-4fda-8dd3-9485d27cee36"),
        fileName: "b.jpg",
      },
    ]);

    const response = await POST(shareRequest(["a.jpg", "b.jpg"]));

    expect(adopted(response).map((result) => result.fileName)).toEqual([
      "a.jpg",
      "b.jpg",
    ]);
  });

  it("carries a refused file and its reason instead of dropping it", async () => {
    upload.uploadDocumentFiles.mockResolvedValue([
      uploaded("de305d54-75b4-431b-adb2-eb6b9e546013"),
      { fileName: "notes.txt", message: "nope", status: "rejected" },
    ]);

    const response = await POST(shareRequest(["a.jpg", "notes.txt"]));

    expect(adopted(response)).toContainEqual({
      fileName: "notes.txt",
      message: "nope",
      status: "rejected",
    });
  });

  it("ingests a file Android put under an unexpected field name", async () => {
    upload.uploadDocumentFiles.mockResolvedValue([
      uploaded("de305d54-75b4-431b-adb2-eb6b9e546013"),
    ]);

    const response = await POST(shareRequest(["receipt.jpg"], "file"));

    expect(adopted(response)).toHaveLength(1);
    expect(upload.uploadDocumentFiles).toHaveBeenCalledWith(
      [expect.any(File)],
      { allowDuplicate: false },
    );
  });

  it("records what a share carried when it carried no files", async () => {
    upload.uploadDocumentFiles.mockResolvedValue([]);

    const formData = new FormData();
    formData.append("title", "Receipt");
    const response = await POST(
      new Request("https://app.example/share-target?v=5", {
        body: formData,
        method: "POST",
      }),
    );

    expect(location(response)).toBe("/upload?share=empty");
    expect(logger.logWarning).toHaveBeenCalledWith(
      "share_target.no_files",
      expect.objectContaining({ fields: "title:text(7)", template: "5" }),
    );
  });

  it("reports a device whose WebAPK predates the version marker", async () => {
    upload.uploadDocumentFiles.mockResolvedValue([]);

    await POST(shareRequest([]));

    expect(logger.logWarning).toHaveBeenCalledWith(
      "share_target.no_files",
      expect.objectContaining({ template: "pre-marker" }),
    );
  });

  it("records a share body it could not parse at all", async () => {
    const response = await POST(
      new Request("https://app.example/share-target", {
        body: "not multipart",
        headers: { "content-type": "multipart/form-data; boundary=missing" },
        method: "POST",
      }),
    );

    expect(location(response)).toBe("/upload?share=unreadable");
    expect(logger.logError).toHaveBeenCalledWith(
      "share_target.unreadable",
      expect.anything(),
      expect.objectContaining({
        contentType: "multipart/form-data; boundary=missing",
      }),
    );
    expect(upload.uploadDocumentFiles).not.toHaveBeenCalled();
  });
});
