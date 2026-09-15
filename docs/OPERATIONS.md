# Operations

Day-to-day operational procedures for the single owner-operator. For the
disaster-recovery restore procedure itself, see
[docs/RESTORE.md](RESTORE.md) — it is not duplicated here. For the secrets
inventory and one-time provider setup, see
[docs/CLOUD_FOUNDATION.md](CLOUD_FOUNDATION.md).

## Backup process

`.github/workflows/backup.yml` runs nightly at 02:00 UTC (and on manual
`workflow_dispatch`), independently of Vercel:

1. `npm run backup:verify-secrets` — confirms all required GitHub Actions
   secrets are present without printing them.
2. `npm run backup:dump-database` — `pg_dump`s `NEON_BACKUP_DATABASE_URL` in
   custom format, always writes `database/daily/YYYY-MM-DD.dump` plus
   `database/weekly/...` on Mondays and `database/monthly/...` on the 1st,
   uploads each to B2 with a JSON manifest, and verifies the uploaded
   object's size.
3. `npm run backup:sync-r2-to-b2` — copies any R2 object not yet safely
   represented in B2, verifying size/hash on the copy.

Each verified step records a `backup_runs` row
(`scripts/backup/record-run.ts`) — a row's mere existence means "verified
success"; nothing is written for a failed step. The Settings page
(`/settings`, `src/server/settings/status.ts`) reads the latest `database`
and `objects` rows and shows "Last successful backup", flagging it stale if
the most recent verified run is more than 36 hours old.

`.github/workflows/restore-test.yml` runs monthly and separately proves a
backup restores into a throwaway Postgres container — see docs/RESTORE.md's
"Scheduled restore testing".

## Restore process

See [docs/RESTORE.md](RESTORE.md) for the full 8-step disaster-recovery
runbook (recreate Neon/R2, restore the latest verified backup, redeploy,
verify consistency). Not repeated here.

## Credential rotation

Never put a raw password or B2 credential in Vercel or an environment file
(README.md "Authentication setup", CLOUD_FOUNDATION.md). Rotate each secret
group independently; nothing here needs a code change.

- **`AUTH_PASSWORD_HASH` / `AUTH_SESSION_SECRET`** — generate a new strong
  password (16+ characters) with a password manager, then:

  ```bash
  npm run auth:hash-password
  npm run auth:generate-session-secret
  ```

  Update both values in Vercel (Development and/or Production, per
  `README.md`'s "Authentication setup"), escaping `$` as `\$` only in local
  `.env` files. Redeploy so the new values take effect.

- **`OPENAI_API_KEY`** — issue a new key in the OpenAI dashboard, set it in
  Vercel for the affected environment, redeploy, then revoke the old key
  once a real document has processed successfully against the new one.

- **R2 keys (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`)** — the owner
  currently uses one account-wide key shared by Development, Production,
  and GitHub Actions (see CLOUD_FOUNDATION.md's "Shared credential risk").
  Create a new key in the Cloudflare dashboard, update it everywhere it's
  used (Vercel Development, Vercel Production, GitHub Actions secrets),
  verify with `npm run cloud:check:r2`, then revoke the old key.

- **B2 keys (`B2_ACCESS_KEY_ID` / `B2_SECRET_ACCESS_KEY`)** — create a new
  key via `b2_create_key` scoped to `rotem-backup` with exactly
  `listBuckets`, `listFiles`, `readFiles`, `writeFiles` (see
  `scripts/cloud/finalize-b2.ts` and CLOUD_FOUNDATION.md's "Backblaze B2"
  section for the exact capability list — never grant delete). Update the
  GitHub Actions secrets only — B2 credentials must never reach Vercel —
  verify with `npm run cloud:check:b2`, then revoke the old key.

- **`DATABASE_URL` / `NEON_BACKUP_DATABASE_URL`** — reset the role password
  (or create a new role) in the Neon console. Update the pooled URL in
  Vercel (`DATABASE_URL`) and the direct URL in GitHub Actions
  (`NEON_BACKUP_DATABASE_URL`) — never put the direct URL in Vercel. Verify
  with `node --env-file=.env.local --import tsx scripts/cloud/verify-postgres.ts`
  and `npm run backup:verify-secrets`.

## Failed AI processing

A document that exhausts the background processor's retries (three
attempts, one- and five-minute delays; invalid AI responses fail
immediately — see README.md's "Background processing") gets status
`FAILED`. It surfaces in two places:

- **Upload tray** — the "Failed" filter lists it with a
  **Retry processing** button (`POST /api/documents/processing/retry`).
- **Document detail** (`/documents/{id}`) — shows "Processing failed.
  Reprocess to try again, or edit the fields below manually." with a
  **Reprocess** button.

Both buttons re-enqueue a `processing_tasks` row for the same best-effort
recovery path uploads use — no manual database edit is needed. If a document repeatedly fails, the fields can always be
corrected by hand on the document detail page regardless of processing
status (manual corrections take priority over AI output — SPEC.md §26).

## Failed backup response

There is no email/Slack alerting — the only signal is the Settings page
(`/settings`) "Last successful backup" badge, which turns to the error tone
and reports "stale" once the most recent verified `backup_runs` row is over
36 hours old, or shows "Not available" if none exists yet. Check it
periodically as part of using the app.

To diagnose a failure:

1. Check the `.github/workflows/backup.yml` run in the repository's Actions
   tab for the failing step and its error output.
2. If it failed at "Verify backup secrets", a GitHub Actions secret is
   missing or was rotated without updating the workflow — see "Credential
   rotation" above.
3. If it failed at "Dump database and upload backup" or "Sync R2 objects to
   B2", re-run the workflow manually (`workflow_dispatch`) once the
   underlying issue (Neon/R2/B2 reachability, expired credential) is fixed.
   No partial state needs cleanup — a failed run simply writes no
   `backup_runs` row, so the next successful run's row is what clears the
   "stale" flag.
4. To reproduce and debug locally rather than only from workflow logs, run
   the same commands from "Backup process" above locally with real
   credentials loaded ad hoc (never committed).
