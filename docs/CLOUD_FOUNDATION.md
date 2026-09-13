# Cloud foundation

The application uses one production cloud environment:

- Vercel hosts the Next.js application.
- Neon Postgres stores structured data.
- Private Cloudflare R2 bucket `rotem` stores primary files.
- Private Backblaze B2 bucket `rotem-backup` stores independent backups.

This single-environment design is an explicit owner decision. Automatic Vercel
deployments are limited to `main`. Preview and Development have no database,
object-storage, authentication, or AI secrets, so they cannot automatically use
production data.

## Verified state

As of September 13, 2026:

- Vercel project `my-business` is connected to `asafmor/my-business` and uses
  Next.js on Node.js 24. It has no deployments yet.
- Dedicated Neon resource `my-business-production` runs on the Free plan in
  Frankfurt and is attached only to Vercel Production.
- The unrelated Neon resource `neon-charcoal-horizon` remains attached to
  `waypoint` and is not attached to `my-business`.
- R2 bucket `rotem` is private. Its public development URL is disabled, and it
  has no custom domain, CORS configuration, or lock rule. Signed
  write/head/read/list checks pass and anonymous reads fail.
- B2 bucket `rotem-backup` is private. Signed write/head/read/list checks pass
  and anonymous reads fail. It has two lifecycle rules.
- The B2 GitHub Actions key is restricted to `rotem-backup` and has exactly
  `listBuckets`, `listFiles`, `readFiles`, and `writeFiles`. It has no
  delete, bucket administration, key administration, retention, legal-hold, or
  governance-bypass capabilities.
- No Object Lock enable request succeeded or was made during final setup. The
  narrow final key cannot read retention configuration, so the provider-side
  Object Lock flag is not independently visible through that credential.
- GitHub Actions has the direct Neon backup URL and the R2 and B2 credentials
  and metadata. B2 credentials are not stored in Vercel.
- `OPENAI_API_KEY` is a Sensitive Vercel Production variable. Live API
  verification is deferred to GitHub Issue #8.

Never put credentials, connection URLs, or command output containing them in
Git, GitHub issues, or CI logs.

## Vercel environment boundary

`vercel.json` permits Git deployments only from `main`. It also uses an
ignore command as a second guard against building another branch.

`src/server/config/cloud-environment.ts` requires `APP_ENV=production` and,
on Vercel, `VERCEL_ENV=production` before creating a database or R2 client. It
also rejects B2 variables in application runtime because B2 is backup-only.

Local development may connect to production only through a deliberate,
git-ignored local environment with `APP_ENV=production`. Treat such commands
as production operations. Prefer mocks and empty fixtures for routine
development. Never make schema changes by hand; commit migrations and run the
project migration command once migration tooling exists.

## Local provisioning worksheet

Copy `.env.cloud.example` to `.env.cloud.local`. The local worksheet is
ignored by Git and must remain mode `0600`. Fill secrets only in that file,
never in command arguments or issue comments.

`OPENAI_API_KEY` is server-only. Never expose it through a `NEXT_PUBLIC_`
variable.

## Neon Postgres

Use the pooled `DATABASE_URL` for normal server runtime. Its hostname contains
`-pooler`, allowing PgBouncer to absorb short-lived serverless connections.

Use the direct, unpooled URL for migrations, `pg_dump`, and `pg_restore`.
Store it as `NEON_BACKUP_DATABASE_URL` only in GitHub Actions. Do not put the
direct URL in Vercel runtime variables.

The production database starts empty. Future schema work must use migrations
committed to Git.

Run the connection check without printing the URL:

```bash
APP_ENV=production node --env-file=.env.cloud.local --import tsx \
  scripts/cloud/verify-postgres.ts
```

## Cloudflare R2

Keep `rotem` private and keep its public development URL and custom domains
disabled. CORS is unnecessary while server code handles uploads and downloads.
If a later feature uploads directly from browsers, add only the required
application origin and methods.

Use an Object Read & Write S3 token restricted to `rotem`. Do not use an
account-wide API token. Store the S3 access key and secret only as Sensitive
Vercel Production values and GitHub Actions secrets.

`npm run cloud:check:r2` writes, heads, lists, and reads
`health/cloud-foundation.txt`, checks its size and content, and confirms that
an anonymous read fails. It leaves the fixed canary because the narrow key has
no delete permission.

## Backblaze B2

Keep `rotem-backup` private and outside application runtime. Its endpoint is
`s3.eu-central-003.backblazeb2.com`, region is `eu-central-003`, and bucket
ID is `64d50e8e76b39173ad00031f`.

The final GitHub Actions application key is restricted to that bucket and has
exactly these B2 Native API capabilities:

```text
listBuckets
listFiles
readFiles
writeFiles
```

The Backblaze console Read and Write preset also grants delete access. The
narrower key was created through `b2_create_key` with a temporary credential
that had `writeKeys`. The finalizer removed the temporary credential from the
local worksheet after creating the narrow key.

The active lifecycle rules are:

- Hide daily database dumps 14 days after upload and delete hidden versions one
  day later.
- Hide weekly database dumps 56 days after upload and delete hidden versions
  one day later.
- Keep monthly database dumps, original documents, reports, and manifests until
  a later documented retention decision replaces indefinite retention.

The owner decided that Object Lock must remain disabled. Do not enable Object
Lock or set a default retention period. Recovery protection comes from a
separate provider, a private bucket, a narrow key without delete access,
lifecycle rules, and future restore verification.

`npm run cloud:check:b2` writes, heads, lists, and reads
`backup/verification/cloud-foundation.txt`, checks its size and content, and
confirms that an anonymous read fails. It leaves the fixed canary because the
backup key has no delete permission.

## GitHub Actions secrets

```text
NEON_BACKUP_DATABASE_URL
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
B2_ENDPOINT
B2_REGION
B2_ACCESS_KEY_ID
B2_SECRET_ACCESS_KEY
B2_BUCKET
```

Only the direct Neon URL belongs in `NEON_BACKUP_DATABASE_URL`. B2 credentials
must never be copied into Vercel.
