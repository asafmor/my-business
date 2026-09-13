CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('UPLOAD', 'EXTRACTION', 'REPROCESSING', 'MANUAL_EDIT', 'CATEGORY_CHANGE', 'REVIEW', 'ARCHIVE', 'REPORT_GENERATION');--> statement-breakpoint
CREATE TYPE "public"."audit_entity_type" AS ENUM('DOCUMENT', 'DOCUMENT_FILE', 'EXPENSE', 'CATEGORY', 'EXTRACTION', 'REPORT');--> statement-breakpoint
CREATE TYPE "public"."audit_source" AS ENUM('AI', 'USER', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."document_file_kind" AS ENUM('ORIGINAL', 'PREVIEW', 'GENERATED_REPORT');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('UPLOADED', 'PROCESSING', 'NEEDS_REVIEW', 'READY', 'FAILED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('RECEIPT', 'SUPPLIER_INVOICE', 'INVOICE_RECEIPT', 'CREDIT_NOTE', 'TAX_DOCUMENT', 'BANK_STATEMENT', 'CONTRACT', 'INSURANCE_DOCUMENT', 'CERTIFICATE', 'GENERATED_REPORT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."report_format" AS ENUM('CSV', 'XLSX', 'PDF');--> statement-breakpoint
CREATE TYPE "public"."storage_provider" AS ENUM('R2', 'B2');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "audit_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"field" varchar(100),
	"old_value" jsonb,
	"new_value" jsonb,
	"source" "audit_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_sort_order_nonnegative" CHECK ("categories"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "document_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"kind" "document_file_kind" NOT NULL,
	"storage_provider" "storage_provider" NOT NULL,
	"bucket" varchar(255) NOT NULL,
	"object_key" varchar(1024) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_files_size_bytes_nonnegative" CHECK ("document_files"."size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "document_type" NOT NULL,
	"status" "document_status" DEFAULT 'UPLOADED' NOT NULL,
	"original_file_id" uuid,
	"sha256" varchar(64) NOT NULL,
	"transaction_date" date,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"supplier_name" varchar(255),
	"supplier_identifier" varchar(255),
	"document_number" varchar(255),
	"transaction_date" date,
	"currency" varchar(3),
	"subtotal" numeric(18, 2),
	"vat" numeric(18, 2),
	"total" numeric(18, 2),
	"category_id" uuid,
	"business_use_percentage" numeric(5, 2) DEFAULT '100' NOT NULL,
	"deductible_vat_percentage" numeric(5, 2) DEFAULT '100' NOT NULL,
	"notes" text,
	"payment_method" varchar(100),
	"reporting_month" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_business_use_percentage_range" CHECK ("expenses"."business_use_percentage" >= 0 AND "expenses"."business_use_percentage" <= 100),
	CONSTRAINT "expenses_deductible_vat_percentage_range" CHECK ("expenses"."deductible_vat_percentage" >= 0 AND "expenses"."deductible_vat_percentage" <= 100)
);
--> statement-breakpoint
CREATE TABLE "extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"provider" varchar(100) NOT NULL,
	"model" varchar(200) NOT NULL,
	"schema_version" varchar(100) NOT NULL,
	"raw_result" jsonb NOT NULL,
	"normalized_result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"reporting_month" date NOT NULL,
	"format" "report_format" NOT NULL,
	"source_version" varchar(100) NOT NULL,
	"file_sha256" varchar(64) NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_file_id_document_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."document_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_idx" ON "categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "document_files_document_id_idx" ON "document_files" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_files_document_id_id_idx" ON "document_files" USING btree ("document_id","id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_original_file_match_fk" FOREIGN KEY ("id", "original_file_id") REFERENCES "public"."document_files"("document_id", "id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_document_file_match_fk" FOREIGN KEY ("document_id", "file_id") REFERENCES "public"."document_files"("document_id", "id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_files_object_key_idx" ON "document_files" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "documents_transaction_date_idx" ON "documents" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "documents_type_idx" ON "documents" USING btree ("type");--> statement-breakpoint
CREATE INDEX "documents_sha256_idx" ON "documents" USING btree ("sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_document_id_idx" ON "expenses" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "expenses_supplier_name_idx" ON "expenses" USING btree ("supplier_name");--> statement-breakpoint
CREATE INDEX "expenses_category_id_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "expenses_transaction_date_idx" ON "expenses" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "extractions_document_id_created_at_idx" ON "extractions" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_file_id_idx" ON "reports" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "reports_reporting_month_idx" ON "reports" USING btree ("reporting_month");--> statement-breakpoint
CREATE FUNCTION prevent_original_document_file_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.kind = 'ORIGINAL' THEN
    RAISE EXCEPTION 'Original document files are immutable';
  END IF;
  RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER document_files_prevent_original_mutation BEFORE UPDATE OR DELETE ON "document_files" FOR EACH ROW EXECUTE FUNCTION prevent_original_document_file_mutation();--> statement-breakpoint
INSERT INTO "categories" ("name", "description", "active", "sort_order") VALUES
  ('Office supplies', 'Stationery and everyday office purchases', true, 0),
  ('Travel', 'Business travel and transportation', true, 1),
  ('Meals and entertainment', 'Business meals and client entertainment', true, 2),
  ('Software and subscriptions', 'Software, SaaS, and subscriptions', true, 3),
  ('Professional services', 'Legal, accounting, and consulting services', true, 4),
  ('Utilities and communications', 'Phone, internet, and utilities', true, 5),
  ('Rent and workspace', 'Rent, coworking, and workspace costs', true, 6),
  ('Marketing and advertising', 'Advertising and promotional costs', true, 7),
  ('Equipment', 'Business equipment and durable goods', true, 8),
  ('Insurance', 'Business insurance', true, 9),
  ('Taxes and fees', 'Taxes, government fees, and bank charges', true, 10),
  ('Other', 'Expenses that do not fit another category', true, 11)
ON CONFLICT ("name") DO NOTHING;
