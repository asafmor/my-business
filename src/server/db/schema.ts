import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  auditActions,
  auditEntityTypes,
  auditSources,
  documentFileKinds,
  documentStatuses,
  documentTypes,
  storageProviders,
} from "@/domain/documents/types";
import type { JsonObject, JsonValue } from "@/domain/documents/types";
import { reportFormats } from "@/domain/reports/types";

export const documentTypeEnum = pgEnum("document_type", documentTypes);
export const documentStatusEnum = pgEnum("document_status", documentStatuses);
export const documentFileKindEnum = pgEnum(
  "document_file_kind",
  documentFileKinds,
);
export const storageProviderEnum = pgEnum("storage_provider", storageProviders);
export const auditSourceEnum = pgEnum("audit_source", auditSources);
export const auditEntityTypeEnum = pgEnum(
  "audit_entity_type",
  auditEntityTypes,
);
export const auditActionEnum = pgEnum("audit_action", auditActions);
export const reportFormatEnum = pgEnum("report_format", reportFormats);
export const processingTaskStatusEnum = pgEnum("processing_task_status", [
  "PENDING",
  "PROCESSING",
  "COMPLETE",
  "FAILED",
]);
export const backupRunKindEnum = pgEnum("backup_run_kind", [
  "database",
  "objects",
]);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: documentTypeEnum("type").notNull(),
    status: documentStatusEnum("status").notNull().default("UPLOADED"),
    // The migration adds a composite FK so the original must belong to this
    // document. It cannot be expressed here without a circular table type.
    originalFileId: uuid("original_file_id"),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    transactionDate: date("transaction_date", { mode: "string" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("documents_transaction_date_idx").on(table.transactionDate),
    index("documents_status_idx").on(table.status),
    index("documents_type_idx").on(table.type),
    index("documents_sha256_idx").on(table.sha256),
  ],
);

export const documentFiles = pgTable(
  "document_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "restrict" }),
    kind: documentFileKindEnum("kind").notNull(),
    storageProvider: storageProviderEnum("storage_provider").notNull(),
    bucket: varchar("bucket", { length: 255 }).notNull(),
    objectKey: varchar("object_key", { length: 1024 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("document_files_document_id_idx").on(table.documentId),
    uniqueIndex("document_files_document_id_id_idx").on(
      table.documentId,
      table.id,
    ),
    uniqueIndex("document_files_object_key_idx").on(table.objectKey),
    check(
      "document_files_size_bytes_nonnegative",
      sql`${table.sizeBytes} >= 0`,
    ),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("categories_name_idx").on(table.name),
    check("categories_sort_order_nonnegative", sql`${table.sortOrder} >= 0`),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "restrict" }),
    supplierName: varchar("supplier_name", { length: 255 }),
    supplierIdentifier: varchar("supplier_identifier", { length: 255 }),
    documentNumber: varchar("document_number", { length: 255 }),
    transactionDate: date("transaction_date", { mode: "string" }),
    currency: varchar("currency", { length: 3 }),
    subtotal: numeric("subtotal", { precision: 18, scale: 2 }),
    vat: numeric("vat", { precision: 18, scale: 2 }),
    total: numeric("total", { precision: 18, scale: 2 }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "restrict",
    }),
    businessUsePercentage: numeric("business_use_percentage", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("100"),
    deductibleVatPercentage: numeric("deductible_vat_percentage", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("100"),
    notes: text("notes"),
    paymentMethod: varchar("payment_method", { length: 100 }),
    reportingMonth: date("reporting_month", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("expenses_document_id_idx").on(table.documentId),
    index("expenses_supplier_name_idx").on(table.supplierName),
    index("expenses_category_id_idx").on(table.categoryId),
    index("expenses_transaction_date_idx").on(table.transactionDate),
    check(
      "expenses_business_use_percentage_range",
      sql`${table.businessUsePercentage} >= 0 AND ${table.businessUsePercentage} <= 100`,
    ),
    check(
      "expenses_deductible_vat_percentage_range",
      sql`${table.deductibleVatPercentage} >= 0 AND ${table.deductibleVatPercentage} <= 100`,
    ),
  ],
);

export const extractions = pgTable(
  "extractions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "restrict" }),
    provider: varchar("provider", { length: 100 }).notNull(),
    model: varchar("model", { length: 200 }).notNull(),
    schemaVersion: varchar("schema_version", { length: 100 }).notNull(),
    rawResult: jsonb("raw_result").$type<JsonObject>().notNull(),
    normalizedResult: jsonb("normalized_result").$type<JsonObject>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("extractions_document_id_created_at_idx").on(
      table.documentId,
      table.createdAt,
    ),
  ],
);

// This durable outbox is the handoff from uploads to post-response dispatch.
export const processingTasks = pgTable(
  "processing_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "restrict" }),
    status: processingTaskStatusEnum("status").notNull().default("PENDING"),
    reprocessing: boolean("reprocessing").notNull().default(false),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    leaseToken: uuid("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    lastErrorCode: varchar("last_error_code", { length: 100 }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("processing_tasks_document_id_idx").on(table.documentId),
    index("processing_tasks_due_idx").on(table.status, table.nextAttemptAt),
    check("processing_tasks_attempts_nonnegative", sql`${table.attempts} >= 0`),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: auditEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: auditActionEnum("action").notNull(),
    field: varchar("field", { length: 100 }),
    oldValue: jsonb("old_value").$type<JsonValue>(),
    newValue: jsonb("new_value").$type<JsonValue>(),
    source: auditSourceEnum("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
    index("audit_events_created_at_idx").on(table.createdAt),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "restrict" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => documentFiles.id, { onDelete: "restrict" }),
    reportingMonth: date("reporting_month", { mode: "string" }).notNull(),
    format: reportFormatEnum("format").notNull(),
    sourceVersion: varchar("source_version", { length: 100 }).notNull(),
    fileSha256: varchar("file_sha256", { length: 64 }).notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("reports_file_id_idx").on(table.fileId),
    index("reports_reporting_month_idx").on(table.reportingMonth),
    foreignKey({
      columns: [table.documentId, table.fileId],
      foreignColumns: [documentFiles.documentId, documentFiles.id],
      name: "reports_document_file_match_fk",
    }).onDelete("restrict"),
  ],
);

// 19.1/19.3: one row per successful, verified backup run. Written only by
// the backup scripts (scripts/backup/*.ts) after their own verification
// step passes — a row's mere existence means "verified success", so the app
// never has to guess whether last night's cron actually ran (19.3).
export const backupRuns = pgTable(
  "backup_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: backupRunKindEnum("kind").notNull(),
    ranAt: timestamp("ran_at", { withTimezone: true }).notNull(),
    detail: text("detail").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("backup_runs_kind_ran_at_idx").on(table.kind, table.ranAt)],
);

export const defaultExpenseCategories = [
  ["Office supplies", "Stationery and everyday office purchases"],
  ["Travel", "Business travel and transportation"],
  ["Meals and entertainment", "Business meals and client entertainment"],
  ["Software and subscriptions", "Software, SaaS, and subscriptions"],
  ["Professional services", "Legal, accounting, and consulting services"],
  ["Utilities and communications", "Phone, internet, and utilities"],
  ["Rent and workspace", "Rent, coworking, and workspace costs"],
  ["Marketing and advertising", "Advertising and promotional costs"],
  ["Equipment", "Business equipment and durable goods"],
  ["Insurance", "Business insurance"],
  ["Taxes and fees", "Taxes, government fees, and bank charges"],
  ["Other", "Expenses that do not fit another category"],
] as const;
