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
