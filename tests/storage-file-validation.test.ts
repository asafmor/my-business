import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  FileValidationError,
  maximumUploadBytes,
  validateUploadFile,
} from "../src/server/storage/file-validation";
import { calculateSha256 } from "../src/server/storage/sha256";

describe("server upload file validation", () => {
  it.each([
    [new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"],
    [
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      "image/png",
    ],
    [
      new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]),
      "image/webp",
    ],
    [new TextEncoder().encode("%PDF-1.7"), "application/pdf"],
  ])("accepts detected %s files", (bytes, mimeType) => {
    expect(validateUploadFile({ bytes, mimeType })).toEqual({
      mimeType,
      sizeBytes: bytes.byteLength,
    });
  });

  it("rejects empty, oversized, unknown, and MIME-mismatched inputs", () => {
    expect(() => validateUploadFile({ bytes: new Uint8Array() })).toThrow(
      FileValidationError,
    );
    expect(() =>
      validateUploadFile({ bytes: new Uint8Array(maximumUploadBytes + 1) }),
    ).toThrow(FileValidationError);
    expect(() =>
      validateUploadFile({ bytes: new TextEncoder().encode("not a file") }),
    ).toThrow(FileValidationError);
    expect(() =>
      validateUploadFile({
        bytes: new Uint8Array([0xff, 0xd8, 0xff]),
        mimeType: "application/pdf",
      }),
    ).toThrow("Declared file type does not match file bytes.");
  });
});

describe("SHA-256", () => {
  it("returns a lowercase digest for uploaded bytes", () => {
    expect(calculateSha256(new TextEncoder().encode("hello"))).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});
