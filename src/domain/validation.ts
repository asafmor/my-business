import { z } from "zod";

import {
  auditActions,
  auditEntityTypes,
  auditSources,
  documentFileKinds,
  documentStatuses,
  documentTypes,
  storageProviders,
} from "./documents/types";
import type { JsonObject, JsonValue } from "./documents/types";
import { reportFormats } from "./reports/types";

export const idSchema = z.uuid();
export const isoDateSchema = z.iso.date();
export const sha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Must be a lowercase SHA-256 hex digest.");
export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Must be an ISO 4217 currency code.");
export const moneySchema = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)\.\d{2}$/, "Must use an exact decimal scale of 2.");
export const percentageSchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,2})?$/, "Must be a decimal with at most 2 places.")
  .refine((value) => Number(value) >= 0 && Number(value) <= 100, {
    message: "Must be between 0 and 100.",
  });
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.number(),
    z.string(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);
export const jsonObjectSchema: z.ZodType<JsonObject> = z.record(
  z.string(),
  jsonValueSchema,
);

export const documentInputSchema = z.object({
  id: idSchema.optional(),
  type: z.enum(documentTypes),
  status: z.enum(documentStatuses).default("UPLOADED"),
  originalFileId: idSchema.nullable().optional(),
  sha256: sha256Schema,
  transactionDate: isoDateSchema.nullable().optional(),
  reviewedAt: z.coerce.date().nullable().optional(),
});

export const documentFileInputSchema = z.object({
  id: idSchema.optional(),
  documentId: idSchema,
  kind: z.enum(documentFileKinds),
  storageProvider: z.enum(storageProviders),
  bucket: z.string().min(1).max(255),
  objectKey: z.string().min(1).max(1024),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  sha256: sha256Schema,
});

export const expenseInputSchema = z.object({
  documentId: idSchema,
  supplierName: z.string().trim().min(1).max(255).nullable().optional(),
  supplierIdentifier: z.string().trim().min(1).max(255).nullable().optional(),
  documentNumber: z.string().trim().min(1).max(255).nullable().optional(),
  transactionDate: isoDateSchema.nullable().optional(),
  currency: currencySchema.nullable().optional(),
  subtotal: moneySchema.nullable().optional(),
  vat: moneySchema.nullable().optional(),
  total: moneySchema.nullable().optional(),
  categoryId: idSchema.nullable().optional(),
  businessUsePercentage: percentageSchema.default("100"),
  deductibleVatPercentage: percentageSchema.default("100"),
  notes: z.string().max(10_000).nullable().optional(),
  paymentMethod: z.string().trim().min(1).max(100).nullable().optional(),
  reportingMonth: isoDateSchema.nullable().optional(),
});

export const extractionInputSchema = z.object({
  documentId: idSchema,
  provider: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(200),
  schemaVersion: z.string().trim().min(1).max(100),
  rawResult: jsonObjectSchema,
  normalizedResult: jsonObjectSchema,
});

export const auditEventInputSchema = z.object({
  entityType: z.enum(auditEntityTypes),
  entityId: idSchema,
  action: z.enum(auditActions),
  field: z.string().trim().min(1).max(100).nullable().optional(),
  oldValue: jsonValueSchema.nullable().optional(),
  newValue: jsonValueSchema.nullable().optional(),
  source: z.enum(auditSources),
});

export const reportInputSchema = z.object({
  documentId: idSchema,
  fileId: idSchema,
  reportingMonth: isoDateSchema,
  format: z.enum(reportFormats),
  sourceVersion: z.string().trim().min(1).max(100),
  fileSha256: sha256Schema,
  generatedAt: z.coerce.date().optional(),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable(),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const documentEditInputSchema = z.object({
  businessUsePercentage: percentageSchema,
  categoryId: idSchema.nullable(),
  currency: currencySchema.nullable(),
  documentId: idSchema,
  documentNumber: z.string().trim().min(1).max(255).nullable(),
  documentType: z.enum(documentTypes),
  notes: z.string().max(10_000).nullable(),
  paymentMethod: z.string().trim().min(1).max(100).nullable(),
  subtotal: moneySchema.nullable(),
  supplierName: z.string().trim().min(1).max(255).nullable(),
  total: moneySchema.nullable(),
  transactionDate: isoDateSchema.nullable(),
  vat: moneySchema.nullable(),
});

export type DocumentEditInput = z.infer<typeof documentEditInputSchema>;
export type DocumentInput = z.infer<typeof documentInputSchema>;
export type DocumentFileInput = z.infer<typeof documentFileInputSchema>;
export type ExpenseInput = z.infer<typeof expenseInputSchema>;
export type ExtractionInput = z.infer<typeof extractionInputSchema>;
export type AuditEventInput = z.infer<typeof auditEventInputSchema>;
export type ReportInput = z.infer<typeof reportInputSchema>;
