import { describe, expect, it } from "vitest";

import {
  databaseDailyBackupKey,
  databaseMonthlyBackupKey,
  databaseWeeklyBackupKey,
  manifestBackupKey,
  objectBackupKeyForSourceKey,
  objectDocumentOriginalBackupKey,
  objectDocumentPreviewBackupKey,
  objectReportPdfBackupKey,
  objectsManifestBackupKey,
} from "../scripts/backup/layout";

const documentId = "de305d54-75b4-431b-adb2-eb6b9e546013";
const reportId = "c56a4180-65aa-42ec-a945-5fd21dec0538";

describe("backup layout", () => {
  it("builds sortable database dump paths", () => {
    const date = new Date(Date.UTC(2026, 8, 14)); // Monday, September 14 2026
    expect(databaseDailyBackupKey(date)).toBe("database/daily/2026-09-14.dump");
    expect(databaseWeeklyBackupKey(date)).toBe("database/weekly/2026-W38.dump");
    expect(databaseMonthlyBackupKey(date)).toBe(
      "database/monthly/2026-09.dump",
    );
  });

  it("handles ISO week boundaries at year edges", () => {
    // January 1 2027 is a Friday, still ISO week 53 of 2026.
    expect(databaseWeeklyBackupKey(new Date(Date.UTC(2027, 0, 1)))).toBe(
      "database/weekly/2026-W53.dump",
    );
  });

  it("mirrors primary object storage keys under an objects/ prefix", () => {
    expect(objectDocumentOriginalBackupKey(documentId)).toBe(
      `objects/documents/${documentId}/original`,
    );
    expect(objectDocumentPreviewBackupKey(documentId)).toBe(
      `objects/documents/${documentId}/preview.webp`,
    );
    expect(objectReportPdfBackupKey(2026, 9, reportId)).toBe(
      `objects/reports/2026/09/${reportId}.pdf`,
    );
    expect(() => objectReportPdfBackupKey(1999, 1, reportId)).toThrow();
    expect(() =>
      objectDocumentOriginalBackupKey("supplier/Office Depot"),
    ).toThrow();
  });

  it("names one manifest per backup run", () => {
    expect(manifestBackupKey(new Date(Date.UTC(2026, 8, 14)))).toBe(
      "manifests/2026-09-14.json",
    );
  });

  it("names the object-sync manifest separately from the database manifest", () => {
    expect(objectsManifestBackupKey(new Date(Date.UTC(2026, 8, 14)))).toBe(
      "manifests/objects-2026-09-14.json",
    );
  });

  it("mirrors a listed R2 source key under objects/", () => {
    expect(
      objectBackupKeyForSourceKey(`documents/${documentId}/original`),
    ).toBe(`objects/documents/${documentId}/original`);
    expect(
      objectBackupKeyForSourceKey(`documents/${documentId}/preview.webp`),
    ).toBe(`objects/documents/${documentId}/preview.webp`);
    expect(objectBackupKeyForSourceKey(`reports/2026/09/${reportId}.pdf`)).toBe(
      `objects/reports/2026/09/${reportId}.pdf`,
    );
  });

  it("rejects source keys outside the recognized namespaces", () => {
    expect(() =>
      objectBackupKeyForSourceKey("health/cloud-foundation.txt"),
    ).toThrow();
  });
});
