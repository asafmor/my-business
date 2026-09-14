CREATE TYPE "public"."backup_run_kind" AS ENUM('database', 'objects');--> statement-breakpoint
CREATE TABLE "backup_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "backup_run_kind" NOT NULL,
	"ran_at" timestamp with time zone NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "backup_runs_kind_ran_at_idx" ON "backup_runs" USING btree ("kind","ran_at");