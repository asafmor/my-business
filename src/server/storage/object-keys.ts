import "server-only";

import { randomUUID } from "node:crypto";

declare const objectKeyBrand: unique symbol;

export type ObjectKey = string & {
  readonly [objectKeyBrand]: "ObjectKey";
};

const uuidExpression =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const uuidPattern = new RegExp(`^${uuidExpression}$`, "i");
const documentKeyPattern = new RegExp(
  `^documents/(${uuidExpression})/(original|preview\\.webp)$`,
  "i",
);
const reportKeyPattern = new RegExp(
  `^reports/(\\d{4})/(\\d{2})/(${uuidExpression})\\.pdf$`,
  "i",
);

function asObjectKey(value: string): ObjectKey {
  return value as ObjectKey;
}

function normalizeId(value: string, label: string): string {
  const id = value.trim();
  if (!uuidPattern.test(id)) {
    throw new Error(`${label} must be a UUID.`);
  }

  return id.toLowerCase();
}

function assertReportPeriod(year: number, month: number): void {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error("Report year must be between 2000 and 9999.");
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Report month must be between 1 and 12.");
  }
}

export function createDocumentId(): string {
  return randomUUID();
}

export function documentOriginalObjectKey(documentId: string): ObjectKey {
  return asObjectKey(
    `documents/${normalizeId(documentId, "Document ID")}/original`,
  );
}

export function documentPreviewObjectKey(documentId: string): ObjectKey {
  return asObjectKey(
    `documents/${normalizeId(documentId, "Document ID")}/preview.webp`,
  );
}

export function reportPdfObjectKey(
  year: number,
  month: number,
  reportId: string,
): ObjectKey {
  assertReportPeriod(year, month);
  return asObjectKey(
    `reports/${year}/${String(month).padStart(2, "0")}/${normalizeId(reportId, "Report ID")}.pdf`,
  );
}

// Persisted keys must still match the closed, opaque key set before use.
export function parseObjectKey(value: string): ObjectKey {
  const documentMatch = documentKeyPattern.exec(value);
  if (documentMatch) {
    return documentMatch[2] === "original"
      ? documentOriginalObjectKey(documentMatch[1])
      : documentPreviewObjectKey(documentMatch[1]);
  }

  const reportMatch = reportKeyPattern.exec(value);
  if (reportMatch) {
    return reportPdfObjectKey(
      Number(reportMatch[1]),
      Number(reportMatch[2]),
      reportMatch[3],
    );
  }

  throw new Error("Object key is not in an allowed storage namespace.");
}
