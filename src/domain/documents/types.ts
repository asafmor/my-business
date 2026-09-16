export const documentTypes = [
  "RECEIPT",
  "SUPPLIER_INVOICE",
  "INVOICE_RECEIPT",
  "CREDIT_NOTE",
  "TAX_DOCUMENT",
  "BANK_STATEMENT",
  "CONTRACT",
  "INSURANCE_DOCUMENT",
  "CERTIFICATE",
  "GENERATED_REPORT",
  "OTHER",
] as const;

export const documentStatuses = [
  "UPLOADED",
  "PROCESSING",
  "NEEDS_REVIEW",
  "READY",
  "FAILED",
  "ARCHIVED",
] as const;

export const documentFileKinds = [
  "ORIGINAL",
  "PREVIEW",
  "GENERATED_REPORT",
] as const;

export const storageProviders = ["R2", "B2"] as const;

export const auditSources = ["AI", "USER", "SYSTEM"] as const;
export const auditEntityTypes = [
  "DOCUMENT",
  "DOCUMENT_FILE",
  "EXPENSE",
  "CATEGORY",
  "EXTRACTION",
  "REPORT",
] as const;
export const auditActions = [
  "UPLOAD",
  "EXTRACTION",
  "REPROCESSING",
  "MANUAL_EDIT",
  "CATEGORY_CHANGE",
  "REVIEW",
  "ARCHIVE",
  "UNARCHIVE",
  "REPORT_GENERATION",
] as const;

export type DocumentType = (typeof documentTypes)[number];
export type DocumentStatus = (typeof documentStatuses)[number];
export type DocumentFileKind = (typeof documentFileKinds)[number];
export type StorageProvider = (typeof storageProviders)[number];
export type AuditSource = (typeof auditSources)[number];
export type AuditEntityType = (typeof auditEntityTypes)[number];
export type AuditAction = (typeof auditActions)[number];

export type JsonValue =
  boolean | number | string | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface Document {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  originalFileId: string | null;
  sha256: string;
  transactionDate: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentFile {
  id: string;
  documentId: string;
  kind: DocumentFileKind;
  storageProvider: StorageProvider;
  bucket: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: Date;
}

export interface Extraction {
  id: string;
  documentId: string;
  provider: string;
  model: string;
  schemaVersion: string;
  rawResult: JsonObject;
  normalizedResult: JsonObject;
  createdAt: Date;
}

export interface AuditEvent {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  field: string | null;
  oldValue: JsonValue | null;
  newValue: JsonValue | null;
  source: AuditSource;
  createdAt: Date;
}
