# Contributing

## Branch strategy

`main` is the single long-lived branch and must remain deployable. Create a
short-lived branch from the latest `main` for each issue, using names such as
`feat/12-document-upload` or `fix/34-upload-timeout`.

Keep each branch limited to one coherent change. Rebase or merge the latest
`main` before integration, require continuous integration to pass, and merge
through a reviewed pull request. Delete the short-lived branch after merging.
Use direct commits to `main` only for repository administration or when the
repository owner explicitly requests them.

Use Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `test:`,
and `chore:`. Reference the GitHub issue in the pull request description and
close it when its definition of done is satisfied.

## Before opening a pull request

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

## Testing

`npm test` runs the vitest unit/integration suite (`tests/*.test.ts`). It is
fully mocked, needs no credentials, runs in seconds, and is what CI runs on
every push.

`npm run test:e2e` runs the Playwright end-to-end suite (`e2e/*.spec.ts`)
against a real running dev server and real Development resources
(`DATABASE_URL`, R2, session secrets - see `vercel env pull .env.local`). It
is **not** run in CI, which has no secrets. Run it locally after
`npm run dev` is up (or let Playwright start it for you) and Development
credentials are pulled. It seeds/archives its own document rows directly via
Drizzle rather than going through a real upload + AI round trip, so it never
calls OpenAI.

Responsive coverage (23.6) is three Playwright projects (desktop/tablet/
mobile viewports, see `playwright.config.ts`) plus a structural smoke spec
(`e2e/responsive.spec.ts`) checking for horizontal overflow and reachable
navigation - no screenshot/visual-regression tooling.
