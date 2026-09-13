import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createDocumentId,
  documentOriginalObjectKey,
  documentPreviewObjectKey,
  parseObjectKey,
  reportPdfObjectKey,
} from "../src/server/storage/object-keys";

const documentId = "de305d54-75b4-431b-adb2-eb6b9e546013";
const reportId = "c56a4180-65aa-42ec-a945-5fd21dec0538";

describe("opaque object keys", () => {
  it("uses random UUIDs and fixed document paths", () => {
    expect(createDocumentId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(documentOriginalObjectKey(documentId)).toBe(
      `documents/${documentId}/original`,
    );
    expect(documentPreviewObjectKey(documentId)).toBe(
      `documents/${documentId}/preview.webp`,
    );
  });

  it("accepts only validated reporting periods and opaque IDs", () => {
    expect(reportPdfObjectKey(2026, 9, reportId)).toBe(
      `reports/2026/09/${reportId}.pdf`,
    );
    expect(() => reportPdfObjectKey(1999, 1, reportId)).toThrow();
    expect(() => reportPdfObjectKey(2026, 13, reportId)).toThrow();
    expect(() => documentOriginalObjectKey("supplier/Office Depot")).toThrow();
  });

  it("rejects persisted keys outside the closed storage namespaces", () => {
    expect(parseObjectKey(`documents/${documentId}/original`)).toBe(
      `documents/${documentId}/original`,
    );
    expect(() => parseObjectKey("documents/Office Depot/original")).toThrow();
    expect(() => parseObjectKey("reports/2026/09/supplier.pdf")).toThrow();
    expect(() => parseObjectKey("other/private-file.pdf")).toThrow();
  });
});
