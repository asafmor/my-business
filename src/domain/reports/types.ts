// Bump when the generated PDF's layout or underlying totals query changes,
// so two reports for the same month can be told apart (SPEC.md #50).
export const reportSourceVersion = "monthly-report-v1";

export const reportFormats = ["CSV", "XLSX", "PDF"] as const;

export type ReportFormat = (typeof reportFormats)[number];

export interface Report {
  id: string;
  documentId: string;
  fileId: string;
  reportingMonth: string;
  format: ReportFormat;
  sourceVersion: string;
  fileSha256: string;
  generatedAt: Date;
}
