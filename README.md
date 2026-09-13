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

Install the exact dependency versions recorded in `package-lock.json`, then
start the Next.js development server:

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>.

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
manager, then generate the two Vercel Production-only variables interactively:

```bash
npm run auth:hash-password
npm run auth:generate-session-secret
```

The password command does not echo input and prints the value for
`AUTH_PASSWORD_HASH`; copy it directly to Vercel, then discard terminal
history or output that captured it. The session-secret command prints a
separate 384-bit value for `AUTH_SESSION_SECRET`. Configure both as encrypted
Vercel Production environment variables only. Never add either value to an
`.env` file or GitHub Actions; B2 credentials also remain unavailable to the
application runtime.

## Database migrations

Drizzle schema definitions and generated SQL migrations are committed under
`src/server/db/` and `drizzle/`. `DATABASE_URL` is exclusively for the normal
server runtime. Applying a migration is a deliberate production operation and
uses the direct `NEON_BACKUP_DATABASE_URL` from the protected local worksheet
or GitHub Actions, never the request path:

```bash
# Generate a migration after changing src/server/db/schema.ts.
npm run db:generate

# Apply committed migrations to the production database.
APP_ENV=production node --env-file=.env.cloud.local --import tsx scripts/db/migrate.ts
```

The migration command rejects non-production environments and missing direct
URLs. Do not run it automatically from Next.js or a request handler.

## AI extraction setup

Configure `OPENAI_API_KEY` only in Vercel Production. Document analysis uses
the server-side OpenAI Responses API and never exposes the key or original
document bytes to the browser. `OPENAI_MODEL` is optional; it defaults to
`gpt-4.1-mini` and accepts only the approved server-side models listed in
`src/server/ai/openai-document-analyzer.ts`.

## Background processing

Uploads write a durable `processing_tasks` row in the same database transaction
as the document record. Vercel Cron invokes the protected
`/api/cron/process-documents` route every minute to lease and process due tasks;
processing therefore does not depend on the upload page remaining open. Set a
high-entropy `CRON_SECRET` as a Vercel Production environment variable. Vercel
uses it to authorize cron invocations; the route rejects all other requests.

The executor retries transient storage and provider failures at most three
times, with one- and five-minute delays. Invalid AI responses fail immediately.
V1 has at-least-once execution and up to one minute dispatch latency; task
leases recover after a function interruption, while the document state and
transactional extraction persistence remain authoritative. Each cron invocation
processes at most ten tasks within a 60-second function budget; V1 has no
dedicated worker fleet or real-time push updates.

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
