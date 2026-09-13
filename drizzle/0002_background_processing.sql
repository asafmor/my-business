CREATE TYPE "public"."processing_task_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');--> statement-breakpoint
CREATE TABLE "processing_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"status" "processing_task_status" DEFAULT 'PENDING' NOT NULL,
	"reprocessing" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"last_error_code" varchar(100),
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processing_tasks_attempts_nonnegative" CHECK ("processing_tasks"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "processing_tasks" ADD CONSTRAINT "processing_tasks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "processing_tasks_document_id_idx" ON "processing_tasks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "processing_tasks_due_idx" ON "processing_tasks" USING btree ("status","next_attempt_at");
--> statement-breakpoint
INSERT INTO "processing_tasks" ("document_id")
SELECT "id" FROM "documents" WHERE "status" = 'UPLOADED'
ON CONFLICT ("document_id") DO NOTHING;
