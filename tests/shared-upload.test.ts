import { describe, expect, it } from "vitest";

import {
  decodeSharedUploads,
  encodeSharedUploads,
  type SharedUploadResult,
} from "../src/domain/documents/shared-upload";

const documentId = "de305d54-75b4-431b-adb2-eb6b9e546013";

function roundTrip(results: SharedUploadResult[]): SharedUploadResult[] {
  return decodeSharedUploads(
    new URLSearchParams(encodeSharedUploads(results)).getAll("shared"),
  );
}

describe("shared upload results", () => {
  it("survives the trip through the redirect URL", () => {
    const results: SharedUploadResult[] = [
      { documentId, fileName: "receipt.pdf", status: "uploaded" },
      { documentId, fileName: "again.pdf", status: "duplicate" },
      { fileName: "notes.txt", message: "Not accepted.", status: "rejected" },
    ];

    expect(roundTrip(results)).toEqual(results);
  });

  it("keeps a file name that contains the field separator", () => {
    expect(
      roundTrip([{ documentId, fileName: "a|b|c.pdf", status: "uploaded" }]),
    ).toEqual([{ documentId, fileName: "a|b|c.pdf", status: "uploaded" }]);
  });

  it("drops anything hand-edited into the URL rather than trusting it", () => {
    expect(
      decodeSharedUploads([
        "uploaded|not-a-uuid||receipt.pdf",
        "invented||-|receipt.pdf",
        `uploaded|${documentId}||`,
        "",
      ]),
    ).toEqual([]);
  });

  it("truncates an oversized file name instead of losing the file", () => {
    const [only] = roundTrip([
      { documentId, fileName: `${"a".repeat(300)}.pdf`, status: "uploaded" },
    ]);

    expect(only?.fileName).toHaveLength(255);
  });
});
