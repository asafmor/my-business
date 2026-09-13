# Cloud foundation

The application has isolated Development and Production cloud environments:

- Vercel hosts the Next.js application in both environments.
- Neon Postgres stores structured data in a dedicated project per environment.
- Private Cloudflare R2 buckets store primary files in a dedicated bucket per
  environment.
- Private Backblaze B2 bucket `rotem-backup` stores independent backups.

This supersedes the earlier production-only decision. Local work and Vercel
Development must use the development resources only. Automatic Git deployments
remain limited to `main`; Preview receives no cloud resource configuration.

## Verified state

As of September 13, 2026:

- Vercel project `my-business` is connected to `asafmor/my-business`, uses
  Next.js on Node.js 24, and has ready Production deployments from `main`.
- Dedicated Neon resource `my-business-production` runs on the Free plan in
  Frankfurt and is attached only to Vercel Production.
- Dedicated Neon resource `my-business-development` runs on the Free plan in
  Frankfurt and is attached only to Vercel Development. Its project identifier
  is `young-poetry-39424785`, which the runtime validates for development.
- Vercel Production and Development retain only their pooled `DATABASE_URL`.
  The direct production URL is stored only as `NEON_BACKUP_DATABASE_URL` in
  GitHub Actions.
- The unrelated Neon resource `neon-charcoal-horizon` remains attached to
  `waypoint` and is not attached to `my-business`.
- R2 bucket `rotem` is private. Its public development URL is disabled, and it
  has no custom domain, CORS configuration, or lock rule. Signed
  write/head/read/list checks pass and anonymous reads fail.
- R2 bucket `my-business-development` is private, empty, located in Western
  Europe, and has no public development URL, custom domain, CORS configuration,
  or lock rule. It is not production storage.
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
- Production variables are unchanged. Development has its isolated Neon URL,
  Neon project identifier, R2 account and bucket identifiers, development auth
  values, and `OPENAI_MODEL`. The owner deliberately reuses the existing
  account-wide R2 credential and may reuse the existing OpenAI key.

Never put credentials, connection URLs, or command output containing them in
Git, GitHub issues, or CI logs.

## Vercel environment boundary

`vercel.json` permits Git deployments only from `main`. It also uses an ignore
command as a second guard against building another branch. Preview has no cloud
configuration. Vercel Development exists to support local `vercel env pull`.

`src/server/config/cloud-environment.ts` accepts only `APP_ENV=development` or
`APP_ENV=production`. When `VERCEL_ENV` is set, it must match `APP_ENV` exactly.
Development also requires the development Neon project identifier and R2 bucket
`my-business-development`; Production requires R2 bucket `rotem`. The runtime
rejects B2 variables and direct/unpooled database variables in either app
environment.

Local development must use `APP_ENV=development` and the isolated resources.
There is no local production application mode. A production migration or backup
is an explicit operational command outside local app runtime. Never make schema
changes by hand; commit migrations and use the project migration command.

## Development setup

After all Vercel Development variables are present, pull them without printing
their values:

```bash
vercel env pull .env.local
chmod 600 .env.local
```

`npm run dev` then supports local login, upload, storage, and document analysis.
The ignored file must contain only the development `APP_ENV`, pooled Neon URL,
Neon project identifier, development R2 values, development auth values, and
development OpenAI key/model. It must not contain B2 or a direct database URL.

Verify the pulled runtime boundary without printing values:

```bash
npm run cloud:check:environment
```

`OPENAI_API_KEY` is server-only. Never expose it through a `NEXT_PUBLIC_`
variable.

### Shared credential risk

The owner deliberately uses the existing account-wide R2 S3 key in both local
Development and Production. The runtime validates `R2_BUCKET` and therefore
prevents the development application from naming `rotem`, but this does not
restrict the credential itself: it can access other buckets in the account.
Keep it ignored, private, and out of logs. A future bucket-scoped key would
reduce this residual risk without changing the application boundary.

The same OpenAI key may be reused in Development and Production. Vercel does
not offer Sensitive variables for its Development target, so keep project
membership restricted and protect all Development values.

## Neon Postgres

Use the pooled `DATABASE_URL` for normal server runtime. Its hostname contains
`-pooler`, allowing PgBouncer to absorb short-lived serverless connections.

Use the direct, unpooled URL for migrations, `pg_dump`, and `pg_restore`.
Store the operational backup copy as `NEON_BACKUP_DATABASE_URL` only in GitHub
Actions. A protected local worksheet may contain it only for a deliberate local
production operation; never put the direct URL in Vercel runtime variables.

Both databases start empty. Future schema work must use migrations committed to
Git. Development migrations are deliberate and use only the pooled development
URL:

Run the connection check without printing the URL:

```bash
node --env-file=.env.local --import tsx scripts/cloud/verify-postgres.ts
npm run db:migrate
```

## Cloudflare R2

Keep both `rotem` and `my-business-development` private and keep their public
development URLs and custom domains disabled. CORS is unnecessary while server
code handles uploads and downloads.
If a later feature uploads directly from browsers, add only the required
application origin and methods.

The owner uses an account-wide Object Read & Write S3 key in both environments.
Application runtime validation requires `my-business-development` in
Development and `rotem` in Production, but does not change the key's broader
account access. Keep the shared key ignored, private, and out of logs.

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
