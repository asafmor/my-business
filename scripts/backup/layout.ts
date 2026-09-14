/**
 * Naming convention for objects written to the backup bucket (B2, via
 * R2 -> B2 sync). Pure path-builders only — no pg_dump execution and no
 * object transfer here; those belong to later issues.
 *
 * Layout:
 *   database/daily/YYYY-MM-DD.dump       - nightly pg_dump (custom format)
 *   database/weekly/YYYY-Www.dump        - ISO week pg_dump (custom format)
 *   database/monthly/YYYY-MM.dump        - calendar month pg_dump (custom format)
 *   objects/documents/{id}/original      - mirrors primary storage 1:1
 *   objects/documents/{id}/preview.webp
 *   objects/reports/YYYY/MM/{id}.pdf
 *   manifests/YYYY-MM-DD.json            - one manifest per backup run
 */

declare const backupKeyBrand: unique symbol;

export type BackupKey = string & {
  readonly [backupKeyBrand]: "BackupKey";
};

const uuidExpression =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const uuidPattern = new RegExp(`^${uuidExpression}$`, "i");
// Mirrors src/server/storage/object-keys.ts's key shapes (that file is
// server-only and cannot be imported from scripts/), so the R2 -> B2 sync
// script can validate a listed R2 key before mirroring it under objects/.
const documentSourceKeyPattern = new RegExp(
  `^documents/(${uuidExpression})/(original|preview\\.webp)$`,
  "i",
);
const reportSourceKeyPattern = new RegExp(
  `^reports/\\d{4}/\\d{2}/${uuidExpression}\\.pdf$`,
  "i",
);

function asBackupKey(value: string): BackupKey {
  return value as BackupKey;
}

function normalizeId(value: string, label: string): string {
  const id = value.trim();
  if (!uuidPattern.test(id)) {
    throw new Error(`${label} must be a UUID.`);
  }
  return id.toLowerCase();
}

function datePart(date: Date): { year: number; month: number; day: number } {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

function isoDate(date: Date): string {
  const { year, month, day } = datePart(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

// ISO 8601 week number (Monday-start weeks, week 1 contains the year's first
// Thursday).
function isoWeek(date: Date): { year: number; week: number } {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNumber = (target.getUTCDay() + 6) % 7; // Monday = 0
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week =
    1 +
    Math.round(
      (target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
  return { year: target.getUTCFullYear(), week };
}

export function databaseDailyBackupKey(date: Date): BackupKey {
  return asBackupKey(`database/daily/${isoDate(date)}.dump`);
}

export function databaseWeeklyBackupKey(date: Date): BackupKey {
  const { year, week } = isoWeek(date);
  return asBackupKey(`database/weekly/${year}-W${pad(week)}.dump`);
}

export function databaseMonthlyBackupKey(date: Date): BackupKey {
  const { year, month } = datePart(date);
  return asBackupKey(`database/monthly/${year}-${pad(month)}.dump`);
}

// Mirrors src/server/storage/object-keys.ts documentOriginalObjectKey under
// an objects/ prefix, so R2 -> B2 sync is a straightforward mirror.
export function objectDocumentOriginalBackupKey(documentId: string): BackupKey {
  return asBackupKey(
    `objects/documents/${normalizeId(documentId, "Document ID")}/original`,
  );
}

// Mirrors documentPreviewObjectKey.
export function objectDocumentPreviewBackupKey(documentId: string): BackupKey {
  return asBackupKey(
    `objects/documents/${normalizeId(documentId, "Document ID")}/preview.webp`,
  );
}

// Mirrors reportPdfObjectKey.
export function objectReportPdfBackupKey(
  year: number,
  month: number,
  reportId: string,
): BackupKey {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error("Report year must be between 2000 and 9999.");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Report month must be between 1 and 12.");
  }
  return asBackupKey(
    `objects/reports/${year}/${pad(month)}/${normalizeId(reportId, "Report ID")}.pdf`,
  );
}

export function manifestBackupKey(date: Date): BackupKey {
  return asBackupKey(`manifests/${isoDate(date)}.json`);
}

// One manifest per R2 -> B2 object-sync run, kept separate from the
// database backup's manifestBackupKey so neither run overwrites the other's
// manifest for the same day.
export function objectsManifestBackupKey(date: Date): BackupKey {
  return asBackupKey(`manifests/objects-${isoDate(date)}.json`);
}

// Generic mirror of a listed R2 object key -> its B2 backup key, for the
// R2 -> B2 sync script (which lists live R2 keys rather than building them
// from known document/report IDs). Throws for keys outside the recognized
// document/report namespaces (e.g. unrelated health-check canary objects),
// so callers can skip those.
export function objectBackupKeyForSourceKey(sourceKey: string): BackupKey {
  if (
    documentSourceKeyPattern.test(sourceKey) ||
    reportSourceKeyPattern.test(sourceKey)
  ) {
    return asBackupKey(`objects/${sourceKey}`);
  }
  throw new Error(
    `Source object key is not in a recognized backup namespace: ${sourceKey}`,
  );
}
