# Disaster recovery runbook

Concrete steps for SPEC.md §35's 8-step restore sequence, using the actual
resources described in `docs/CLOUD_FOUNDATION.md`. This is a manual,
on-demand procedure — it is not wired into `.github/workflows/backup.yml`
(that workflow only runs the nightly backup).

Run every command below locally, never in CI, using real B2/Neon
credentials loaded ad hoc (never committed, never in Vercel).

## 1. Create/recover the Neon database

In the Neon console, create (or confirm) the project for the environment
being recovered (`my-business-development`, project id
`young-poetry-39424785`, or `my-business-production`, project id
`royal-mode-75259763`), region Frankfurt, Free plan. Note both the pooled
connection string (`-pooler` in the hostname — this becomes `DATABASE_URL`)
and the direct/unpooled connection string (this is the restore target,
`RESTORE_TARGET_DATABASE_URL` below).

## 2. Apply required infrastructure/configuration

Run migrations against the fresh database so its schema matches
`drizzle/`:

```bash
DATABASE_URL="<pooled connection string>" npm run db:migrate
```

(`db:migrate` is Development-only per AGENTS.md; for Production this is a
deliberate manual operation outside local app runtime.)

## 3. Restore the latest verified PostgreSQL backup

```bash
RESTORE_TARGET_DATABASE_URL="<direct/unpooled connection string>" \
B2_ENDPOINT=s3.eu-central-003.backblazeb2.com \
B2_REGION=eu-central-003 \
B2_ACCESS_KEY_ID=... \
B2_SECRET_ACCESS_KEY=... \
B2_BUCKET=rotem-backup \
npm run backup:restore-database
```

With no argument this picks the most recent `database/daily/*.dump` key in
B2. Pass an explicit key (e.g. `database/weekly/2026-W37.dump`) as the
first argument after `--` to restore a specific backup instead:

```bash
npm run backup:restore-database -- database/weekly/2026-W37.dump
```

The script downloads the dump, verifies its sha256 against the checksum
B2 recorded in the object's own metadata, runs `pg_restore --clean
--if-exists` against `RESTORE_TARGET_DATABASE_URL`, and then runs a handful
of `SELECT 1 FROM <table> LIMIT 1` checks against the tables in
`src/server/db/schema.ts` to confirm the restored schema is queryable.

`RESTORE_TARGET_DATABASE_URL` must never equal `DATABASE_URL` or
`NEON_BACKUP_DATABASE_URL` — the script refuses to run if it does, so a
restore can never silently target the wrong database.

## 4. Create/recover the R2 bucket

In the Cloudflare dashboard, create (or confirm) a private R2 bucket named
`my-business-development` or `rotem` for the environment being recovered,
keeping it private with no public development URL, no custom domain, and no
CORS configuration (see "Cloudflare R2" in `docs/CLOUD_FOUNDATION.md`).
Reuse the existing account-wide R2 S3 key, or create a scoped one.

## 5. Copy backed-up objects from B2 to R2

```bash
RESTORE_TARGET_R2_BUCKET=<the bucket from step 4> \
R2_ACCOUNT_ID=... \
R2_ACCESS_KEY_ID=... \
R2_SECRET_ACCESS_KEY=... \
B2_ENDPOINT=s3.eu-central-003.backblazeb2.com \
B2_REGION=eu-central-003 \
B2_ACCESS_KEY_ID=... \
B2_SECRET_ACCESS_KEY=... \
B2_BUCKET=rotem-backup \
npm run backup:restore-objects
```

This enumerates everything under `objects/` in B2, copies each object back
to its original key in `RESTORE_TARGET_R2_BUCKET` (`objects/documents/{id}/original`
→ `documents/{id}/original`, etc), and verifies size and sha256 on the
restored copy. `RESTORE_TARGET_R2_BUCKET` must never equal `R2_BUCKET` — the
script refuses to run if it does.

## 6. Configure application secrets

In Vercel project settings for the target environment, set: pooled
`DATABASE_URL`, `NEON_PROJECT_ID`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `AUTH_SESSION_SECRET`,
`AUTH_PASSWORD_HASH`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `APP_ENV`. Never put
B2 credentials or a direct/unpooled database URL in Vercel — the app
rejects both at startup (`assertCloudEnvironment` in
`src/server/config/cloud-environment.ts`).

## 7. Deploy the Next.js application

Deploy `main` to the target Vercel environment (Production deploys
automatically from `main`; Development is supported through
`vercel env pull` for local runs). Confirm the deployment boots and
`npm run cloud:check:environment` passes against the pulled variables.

## 8. Run consistency verification

```bash
node --env-file=.env.local --import tsx scripts/db/check-consistency.ts
```

or, with B2 credentials also loaded, to additionally confirm backup
coverage in B2:

```bash
DATABASE_URL=... R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=... \
B2_ENDPOINT=... B2_REGION=... B2_ACCESS_KEY_ID=... B2_SECRET_ACCESS_KEY=... B2_BUCKET=... \
npm run db:check-consistency
```

This checks, per SPEC.md §35: every `document_files` row's object exists in
R2, its R2 sha256 matches the database, a backup copy exists in B2 (only
when B2 credentials are present — the deployed app never receives them),
and reports any R2 objects with no matching database row. It exits non-zero
if either of the two required checks (object exists, sha256 matches) fails.

## Verifying this works

A real test restore has not been performed as part of this issue — doing so
needs real B2 credentials and a real `NEON_BACKUP_DATABASE_URL`, neither of
which exist in this sandbox, plus a throwaway Postgres target this sandbox
cannot stand up. The tooling above is validated by code review and unit
tests with fully mocked S3/`pg_restore` clients (see
`tests/backup-restore-database.test.ts`,
`tests/backup-restore-objects.test.ts`); `scripts/db/check-consistency.ts`
was additionally run for real, read-only, against the Development database
and R2 bucket.

Before relying on this runbook in an actual disaster, an operator with real
credentials must perform a genuine test restore once (steps 1–5 above
against a scratch Neon project and R2 bucket) and check:

- **Document queries** — the app (or a direct query) can list and fetch
  restored documents by id, status, and type.
- **Expense data** — restored `expenses` rows still join correctly to their
  `documents` row and retain supplier, amounts, and category.
- **Manual corrections** — any expense fields a person had edited after
  extraction (category, business-use percentage, notes, etc) reflect the
  edited values, not the original AI extraction.
- **Audit history** — `audit_events` rows for a restored document/expense
  are present and still resolve to a coherent before/after diff.

Record the result (pass/fail, what was checked, when) wherever this
project tracks operational runs. The _automated, recurring_ version of this
exact drill — restoring into a throwaway Postgres on a schedule and
smoke-testing it — is issue `21-scheduled-restore-testing`, not this one.

## Scheduled restore testing

`.github/workflows/restore-test.yml` runs `npm run backup:run-restore-test`
monthly (plus `workflow_dispatch` for a manual run), against a throwaway
`postgres:18` GitHub Actions service container — never a real database. The
job: migrates the container to the current schema, restores the latest
verified daily backup into it via `restore-database.ts`'s exported
functions, then checks representative tables (`documents`, `expenses`) are
readable and that the schema's foreign keys (`document_files`, `expenses`,
`extractions`, `processing_tasks`, `reports` → their parent tables) have no
orphan rows. On success it records a `restore_test` row in the real
`backup_runs` table (via `NEON_BACKUP_DATABASE_URL`) — the timestamp of the
last successful automated restore test. The throwaway container is
destroyed automatically when the job ends; nothing needs cleaning up by
hand.
