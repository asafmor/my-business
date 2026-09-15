# AGENTS.md

My Business is a private document and expense-management app. It stores source documents, extracts bookkeeping data for review, and keeps independent backups.

Read `docs/SPEC.md` and `docs/PLAN.md` when broader product or implementation context is needed.

## Stack

- Node.js 24
- npm 11
- Next.js
- TypeScript
- Drizzle
- Neon
- Cloudflare R2
- OpenAI Responses API
- Vercel

## Setup

```bash
npm ci
vercel env pull .env.local
npm run dev
```

App: `http://localhost:3000`

Use Development resources only. Never Production.

Never commit `.env.local` or secrets.

## Validate

Before finishing work:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Formatting:

```bash
npm run format
npm run format:check
```

## Database

Schema:

`src/server/db/schema.ts`

Migrations:

`drizzle/`

After schema changes:

```bash
npm run db:generate
npm run db:migrate
```

`db:migrate` is Development only.

Never run migrations from application runtime or request handlers.

## Structure

```text
src/
  app/          Routes and layouts
  components/   Reusable UI
  domain/       Business rules
  lib/          Shared utilities
  server/       Server-only integrations/services
```

Keep provider integrations in `src/server/`.

Browser/UI code must never access credentials or providers directly.

## Background work

Uploads create durable `processing_tasks`.

Processing is best-effort after requests. Pending tasks recover on later authenticated requests.

No cron. No worker fleet. No real-time push in V1.

Do not make uploads wait for document processing.

## Rules

- Use npm. Keep `package-lock.json`.
- Keep changes focused.
- Add/update tests when behavior changes.
- Preserve Development/Production isolation.
- Never expose secrets or original document bytes to browser code.
- Never put B2 credentials in app environment files.
- `DATABASE_URL` is runtime DB access only.
- Run all validation before finishing.
- See `docs/CLOUD_FOUNDATION.md` for cloud setup.
- See `CONTRIBUTING.md` for Git workflow.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
