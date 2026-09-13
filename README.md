# My Business

My Business is a private document and expense-management application. The V1
will preserve source documents, extract bookkeeping data for review, and keep
independent backups.

The project is currently in its foundation stage. See [the product
specification](docs/SPEC.md) and [implementation plan](docs/PLAN.md) for the
planned scope.

## Prerequisites

- Node.js 24
- npm 11

## Local development

Install the exact dependency versions recorded in `package-lock.json`. Local
development uses the isolated Vercel Development Neon project and R2 bucket,
never Production. After Development variables are complete, pull them through
the Vercel CLI and start the server:

```bash
npm ci
vercel env pull .env.local
npm run dev
```

Open <http://localhost:3000>.

`.env.local` is ignored and must remain private. It needs `APP_ENV=development`,
the pooled development `DATABASE_URL`, `NEON_PROJECT_ID`, development R2 values,
`AUTH_PASSWORD_HASH`, `AUTH_SESSION_SECRET`, `OPENAI_API_KEY`, and
`OPENAI_MODEL`. It must not contain B2 credentials or a direct database URL.
The owner uses an account-wide R2 key for both environments. Runtime validation
prevents the development app from naming the production bucket, but the key can
access more than the development bucket and must remain ignored and private.
See [Cloud foundation](docs/CLOUD_FOUNDATION.md) for the one-time provider setup.

## Validation

Run the same checks as continuous integration:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Use `npm run format` to format supported files and `npm run format:check` to
check formatting without changing files.

## Authentication setup

Authentication uses bcrypt with cost 12 because its pure-JavaScript
implementation runs consistently in the Next.js server runtime on Vercel. Do
not store the raw password in source control, local environment files, or
Vercel. Generate a unique password of at least 16 characters with a password
manager, then generate the two environment-specific variables interactively:

```bash
npm run auth:hash-password
npm run auth:generate-session-secret
```

The password command does not echo input and prints `AUTH_PASSWORD_HASH`; the
session command prints a separate 384-bit `AUTH_SESSION_SECRET`. Use distinct
values for Development and Production. Vercel does not support Sensitive values
for its Development target, so restrict project membership and use only
development-only values there. Never add raw passwords or B2 credentials to an
environment file or GitHub Actions.

## Database migrations

Drizzle schema definitions and generated SQL migrations are committed under
`src/server/db/` and `drizzle/`. `DATABASE_URL` is exclusively for normal
application runtime. Development migrations use the isolated pooled development
URL and remain a deliberate command. Production migrations use the direct
`NEON_BACKUP_DATABASE_URL` from GitHub Actions or a protected operational
worksheet, never a request path:

```bash
# Generate a migration after changing src/server/db/schema.ts.
npm run db:generate

# Apply committed migrations to the development database.
npm run db:migrate
```

The command validates the target before connecting. It rejects Preview, a
development configuration that names production resources, and direct database
runtime variables. Do not run migrations automatically from Next.js or a
request handler.

## AI extraction setup

Configure a development-scoped `OPENAI_API_KEY` for Vercel Development and a
production key for Production, or reuse the existing key where that is the
owner's choice. Document analysis uses the server-side OpenAI Responses API and
never exposes the key or original document bytes to the browser. `OPENAI_MODEL`
defaults to `gpt-4.1-mini` and accepts only the approved server-side models
listed in `src/server/ai/openai-document-analyzer.ts`.

## Background processing

Uploads write a durable `processing_tasks` row in the same database transaction
as the document record. After a successful upload or retry, the application
uses Next.js post-response work to make an immediate best-effort processing
attempt. Authenticated page requests and processing-status refreshes also
schedule recovery of due tasks. This does not make the user wait or expose
provider credentials or document data to the browser.

The executor retries transient storage and provider failures at most three
times, with one- and five-minute delays. Invalid AI responses fail immediately.
V1 has no scheduled jobs: durable pending work is recovered on the next
authenticated application request. Consequently, processing can remain pending
while nobody opens the app. Task leases recover after a function interruption,
while document state and transactional extraction persistence remain
authoritative. V1 has no dedicated worker fleet or real-time push updates.

## Project structure

```text
src/
  app/          Next.js routes and layouts
  components/   Reusable application UI
  domain/       Business concepts and rules
  lib/          Shared framework-agnostic utilities
  server/       Server-only integrations and services
```

Route groups under `src/app` separate public pages from pages that will require
authentication. Infrastructure integrations belong behind modules in
`src/server`; UI modules must not access service credentials or providers
directly.

Cloud resource boundaries, secret scopes, provisioning steps, and smoke checks
are documented in [docs/CLOUD_FOUNDATION.md](docs/CLOUD_FOUNDATION.md).

## Contributing

The repository uses npm and commits its lockfile. Keep pull requests focused,
add tests when behavior changes, and run all validation commands before
merging. [CONTRIBUTING.md](CONTRIBUTING.md) defines the branch strategy.

Last reviewed: 2026-09-13.
