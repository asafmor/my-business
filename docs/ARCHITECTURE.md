# Architecture

A consolidated reference for how the pieces fit together. This restates
nothing that already has one canonical home — it links out instead. For
full detail see [docs/SPEC.md](SPEC.md) (product/technical spec),
[docs/CLOUD_FOUNDATION.md](CLOUD_FOUNDATION.md) (provider setup, secrets),
and [docs/RESTORE.md](RESTORE.md) (backup/restore runbook).

## System diagram

Adapted from SPEC.md §20/§62 to the resources actually provisioned (see
CLOUD_FOUNDATION.md):

```text
                         Internet
                            │
                            ▼
                    ┌──────────────┐
                    │    Vercel    │
                    │   Next.js    │  ← SSR + BFF + auth, no separate backend
                    └──────┬───────┘
                           │
               ┌───────────┼────────────┐
               │           │            │
               ▼           ▼            ▼
          Neon Postgres  Cloudflare R2  OpenAI Responses API
          (structured    (primary
           data)          document files)
               │           │
               └─────┬─────┘
                     │
         GitHub Actions (independent of Vercel)
                     │
                     ▼
                Backblaze B2 (backup only)
```

Next.js is the only application tier (SPEC.md §21-22): it owns
authentication, database access, storage URL generation, AI invocation, and
report generation. The browser never talks to Neon, R2, B2, or OpenAI
directly.

## Domain model

`Document` is the central abstraction (SPEC.md §2.1, §25); everything else
hangs off it. Field-level detail lives in
[`src/server/db/schema.ts`](../src/server/db/schema.ts) — this is a map,
not a copy:

| Table              | Purpose                                                                                                                                                                          | Key relationships                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `documents`        | One row per uploaded source document (type, status, sha256, transaction date)                                                                                                    | `originalFileId` → `document_files`                           |
| `document_files`   | Each stored object for a document (`ORIGINAL`, `PREVIEW`, `GENERATED_REPORT`) — provider, bucket, object key, size, sha256                                                       | `documentId` → `documents`                                    |
| `expenses`         | Bookkeeping fields for a document (supplier, amounts, VAT, category, business-use %) — kept separate so `documents` doesn't grow hundreds of type-specific columns (SPEC.md §25) | `documentId` → `documents` (1:1), `categoryId` → `categories` |
| `categories`       | Expense categories (seeded with `defaultExpenseCategories`)                                                                                                                      | referenced by `expenses`                                      |
| `extractions`      | One row per AI extraction attempt (provider, model, schema version, raw + normalized result) — never overwritten, so model/schema changes are auditable                          | `documentId` → `documents`                                    |
| `processing_tasks` | Durable outbox for background AI processing (status, attempts, lease, next-attempt time)                                                                                         | `documentId` → `documents`                                    |
| `audit_events`     | Field-level change history (old/new value, source: `AI`/`USER`/`SYSTEM`) — never overwrites provenance (SPEC.md §26, §48)                                                        | polymorphic `entityType`/`entityId`                           |
| `reports`          | Generated monthly PDF report artifacts                                                                                                                                           | `documentId`/`fileId` → `documents`/`document_files`          |
| `backup_runs`      | One row per _verified successful_ backup/restore-test run, written only by `scripts/backup/*.ts` (see "Backup model" below)                                                      | none — standalone log                                         |

Manual corrections never overwrite what the AI extracted; `audit_events`
preserves both (SPEC.md §26).

## Storage model

Two Cloudflare/Backblaze buckets, both **private, no public access, no
custom domain** (verified state in CLOUD_FOUNDATION.md):

- **Cloudflare R2** (`rotem` in Production, `my-business-development` in
  Development) is the primary store for original files, previews, and
  generated reports. Object keys use random document/report IDs, never
  business data (SPEC.md §27):
  `documents/{id}/original`, `documents/{id}/preview.webp`,
  `reports/{year}/{month}/{reportId}.pdf` — see
  [`src/server/storage/object-keys.ts`](../src/server/storage/object-keys.ts).
- **Backblaze B2** (`rotem-backup`) is an independent, application-inaccessible
  backup destination reachable only from GitHub Actions. Its layout mirrors
  R2 under `objects/` plus `database/{daily,weekly,monthly}/` dumps and
  `manifests/` — the exact convention is in CLOUD_FOUNDATION.md's "Backup
  layout convention".

The application never returns a bucket URL directly: every document/report
download goes browser → Next.js (`requireSession()`) → a short-lived signed
R2 URL (`src/server/storage/private-access.ts`, SPEC.md §42). B2 is never
reachable from the app at all — only from GitHub Actions with its own
narrowly-scoped key.

## Authentication model

Single-account, password-only login (SPEC.md §37-44):

- The login password is never stored; only its bcrypt (cost 12) hash,
  `AUTH_PASSWORD_HASH`, plus an unrelated `AUTH_SESSION_SECRET` for session
  signing — see `src/server/auth/service.ts` and `src/server/auth/password.ts`.
- A successful login sets a signed, `HttpOnly`/`Secure` session cookie
  (`src/lib/auth-session.ts`); there is no database session table (single
  user, no revocation/device-management requirement yet).
- Every protected page, Server Action, and Route Handler calls
  `requireSession()` / `requireRequestSession()`
  (`src/server/auth/guards.ts`, `src/server/auth/service.ts`) — middleware
  is not the sole security boundary.
- `/login` is rate-limited in-memory (5 attempts / 10-minute window, 15-minute
  lockout — `src/server/auth/rate-limit.ts`) and failed/rate-limited attempts
  are logged as structured security events (`src/server/auth/security-events.ts`).
- Mutations validate same-origin (`assertPostFromSameOrigin`) as CSRF
  protection instead of unauthenticated generic endpoints.

See README.md's "Authentication setup" for the actual rotation commands.

## Backup model

Backups run from **GitHub Actions**, deliberately independent of Vercel, so
a Vercel outage can't stop backups (SPEC.md §29). Nightly
(`.github/workflows/backup.yml`, 02:00 UTC): `pg_dump` the direct Neon
connection to B2 (daily always, weekly on Mondays, monthly on the 1st), then
sync any R2 objects not yet safely in B2 — both steps verify the uploaded
object's size/hash before the run counts as successful, and only then write
a `backup_runs` row (`scripts/backup/record-run.ts`) that the Settings page
reads to show "Last successful backup" (`src/server/settings/status.ts`).
Monthly, `.github/workflows/restore-test.yml` proves a backup actually
restores into a throwaway Postgres container. Full operational detail —
day-to-day backup process, restore steps, and what to do when either fails
— is in [docs/OPERATIONS.md](OPERATIONS.md) and
[docs/RESTORE.md](RESTORE.md).
