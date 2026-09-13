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
