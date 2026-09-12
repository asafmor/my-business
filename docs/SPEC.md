# My Business

## 1. Purpose

My Business is a small private cloud application for managing financial and business documents for an independent business owner.

The first version focuses on receipts and expenses:

1. Upload a photographed or digital receipt.
2. Preserve the original document safely.
3. Extract structured information using generative AI.
4. Let the user review and correct the extracted information.
5. Categorize and organize expenses.
6. Search and browse historical documents.
7. Produce monthly reports and exports.
8. Maintain independent backups of both documents and bookkeeping data.

The application should be simple enough for a single non-technical user, while its internal model should allow it to expand later to other document types and business workflows.

Possible future document types include:

* supplier invoices
* invoice-receipts
* credit notes
* tax documents
* bank statements
* contracts
* insurance documents
* certificates
* generated reports
* other business records

For this reason, the system should use **Document** rather than **Receipt** as its central abstraction.

---

# 2. Product principles

## 2.1 Preserve the source

An uploaded original document is immutable.

The system may generate:

* thumbnails
* optimized previews
* extracted text
* AI analysis
* normalized metadata
* bookkeeping information

But none of these should replace or modify the original file.

---

## 2.2 Human data has higher authority than AI data

AI extraction is a starting point.

When the user corrects:

* supplier
* date
* amount
* VAT
* category
* description
* document type
* deductible percentage
* or any other field

the manually confirmed value becomes authoritative.

Reprocessing a document with AI must never silently overwrite a manual correction.

---

## 2.3 Data durability is a core feature

The application stores financially meaningful information.

Both of these are important:

* original documents
* structured metadata and user corrections

Neither should depend on a single storage provider.

---

## 2.4 Keep the user workflow short

The common flow should be:

**Upload → AI processes → Review if necessary → Done**

Documents with confident extraction should require very little interaction.

Documents needing attention should clearly explain what needs review.

---

## 2.5 Build for more than receipts without building unnecessary features now

The initial UX is expense-oriented, but generic concepts should be used internally where appropriate.

For example:

* `Document`, not `Receipt`
* `DocumentType`, not `ReceiptType`
* `DocumentFile`, not `ReceiptImage`

Receipt-specific fields can exist where they make sense.

---

# 3. Primary user

Version 1 is intended for one business owner.

There is therefore no need initially for:

* organizations
* teams
* invitations
* role management
* complex permissions
* multi-tenant billing

Authentication should still be implemented cleanly so a real identity system could replace it later.

---

# 4. Main user workflows

## 4.1 Upload a document

The user can upload:

* JPEG
* PNG
* WebP
* PDF

Sources may include:

* phone camera
* downloaded digital receipt
* email attachment saved locally
* scanned document

Multiple files should be uploadable together.

After upload:

1. Generate a unique document ID.
2. Calculate SHA-256 of the original file.
3. Check for likely duplicates.
4. Store the immutable original in Cloudflare R2.
5. Create the document record in PostgreSQL.
6. Queue or start AI extraction.
7. Update processing status.
8. Present the result for review if needed.

The UI should acknowledge the upload immediately rather than requiring the user to remain on the upload screen while AI processing completes.

---

# 5. AI document processing

AI should extract a normalized representation such as:

* document type
* supplier/business name
* supplier identifier when available
* document/invoice number
* transaction date
* currency
* subtotal
* VAT amount
* total amount
* payment method when visible
* individual line items when useful
* suggested expense category
* textual description
* confidence information
* detected anomalies

The original AI response may also be retained for troubleshooting and future reprocessing.

However, the application should maintain a separate normalized representation used by the actual product.

Do not make reports depend directly on arbitrary AI JSON.

---

# 6. Review workflow

Documents should have simple processing states.

Recommended initial states:

* `UPLOADED`
* `PROCESSING`
* `NEEDS_REVIEW`
* `READY`
* `FAILED`
* `ARCHIVED`

`NEEDS_REVIEW` may be triggered by:

* low-confidence extraction
* missing amount
* missing date
* unclear supplier
* invalid totals
* suspicious VAT calculation
* duplicate detection
* unsupported file
* user-defined business rule

The user should be able to manually mark a document as reviewed.

---

# 7. Expense bookkeeping

For expense documents, maintain normalized bookkeeping information.

Examples:

* supplier
* transaction date
* category
* description
* gross amount
* VAT
* net amount
* currency
* business-use percentage
* deductible VAT percentage
* notes
* payment method
* reporting month
* approval/review state

The application should distinguish between:

**Extracted value**
and
**Current accepted value**

This allows the system to retain AI provenance while respecting user corrections.

---

# 8. Duplicate detection

Every uploaded original receives a SHA-256 hash.

Exact hash matches are strong duplicate candidates.

Later versions can additionally detect likely duplicates using combinations such as:

* supplier
* date
* amount
* invoice number

The system should warn rather than automatically delete suspected duplicates.

---

# 9. Reports

## 9.1 Monthly report

A monthly report should summarize:

* number of documents
* total expenses
* VAT
* expenses before VAT
* expenses by category
* expenses by supplier
* documents requiring review
* potentially missing or problematic data

The user should be able to move between months easily.

---

## 9.2 Export

Initial export formats:

* CSV
* Excel-compatible data
* PDF summary

A later accountant-specific export format can be added when its exact requirements are known.

Generated report files should themselves be modeled as documents/artifacts rather than arbitrary files scattered around storage.

---

# 10. Search and browsing

Documents should be searchable and filterable by:

* free text
* supplier
* date range
* month
* document type
* category
* amount range
* processing/review status

Default ordering should be newest transaction date first.

Filters should be reflected in the URL where practical so browser history and bookmarking work naturally.

---

# 11. Application UI

## 11.1 Overall shell

All authenticated application pages use a persistent three-area structure:

```text
┌──────────────────────────────────────────────────────────────┐
│ Header                                                       │
├────────────────┬─────────────────────────────────────────────┤
│                │                                             │
│ Sidebar        │ Main content                                │
│                │                                             │
│                │                                             │
│                │                                             │
└────────────────┴─────────────────────────────────────────────┘
```

The shell should remain generic enough to support future business-management features.

---

# 12. Header

The header should remain small.

Recommended contents:

* application name/logo
* global `Upload` action
* optional global search
* current user indicator
* logout menu

On mobile, the header also exposes the sidebar navigation.

`Upload` should be one of the easiest actions to find anywhere in the application.

---

# 13. Sidebar

Initial navigation:

### Dashboard

Overview of the current month and anything requiring attention.

### Documents

Complete searchable document archive.

### Inbox

New, processing, failed, or review-required documents.

### Reports

Monthly summaries and generated exports.

### Categories

Expense categorization configuration.

### Settings

Application-level configuration and later integrations.

The information architecture deliberately says **Documents**, rather than Receipts.

As the application grows, the sidebar could later contain areas such as:

* Income
* Contracts
* Tax
* Customers
* Suppliers
* Statements

without changing the fundamental shell.

---

# 14. Dashboard

The dashboard is the default authenticated route.

Its purpose is to answer:

**“What is the current state of my bookkeeping?”**

Suggested content:

### Current month

* total expenses
* VAT
* document count
* number waiting for review

### Needs attention

A compact list of documents where action is required.

### Recent documents

The latest uploaded or edited documents.

### Categories

A simple expense breakdown.

### Quick actions

* upload document
* open inbox
* generate/export monthly report

Avoid turning the dashboard into a dense analytics product.

Its main purpose is orientation and action.

---

# 15. Inbox

The Inbox is workflow-oriented rather than archival.

Sections or filters:

* Needs review
* Processing
* Failed
* Recently completed

A document requiring attention should clearly state why.

Examples:

> Amount could not be determined.

> VAT differs from the expected calculation.

> Possible duplicate detected.

> Supplier name has low confidence.

The user should be able to resolve common cases directly without opening a large editing form.

---

# 16. Documents page

Desktop layout should use a compact table or structured list.

Suggested columns:

* preview
* date
* supplier
* type
* category
* total
* VAT
* status

Useful controls:

* search
* month/date range
* category
* document type
* status
* sort

On mobile, records should become cards rather than forcing a wide table.

---

# 17. Document detail page

This is one of the most important screens in the product.

Desktop layout:

```text
┌─────────────────────────┬──────────────────────────┐
│                         │                          │
│ Original document       │ Document information     │
│ preview                 │                          │
│                         │ Editable fields          │
│                         │                          │
│                         │ AI / review indicators   │
│                         │                          │
└─────────────────────────┴──────────────────────────┘
```

The user should be able to compare the original and extracted information without switching screens.

Editable data includes:

* supplier
* date
* document number
* amount
* VAT
* category
* business percentage
* notes
* document type

The screen should visibly distinguish:

* normal values
* values needing review
* manually corrected values

An expandable section may expose:

* original AI extraction
* processing history
* file metadata
* audit history

These should not clutter the common workflow.

---

# 18. Upload experience

Upload should support:

* drag and drop
* file picker
* mobile camera/photo picker
* multiple files

After upload, display individual progress/status cards.

Example:

```text
office-depot.jpg
✓ Uploaded
○ Analysing...

restaurant.pdf
✓ Uploaded
✓ Analysed
⚠ Review VAT
```

The user does not need to wait for all uploaded documents before leaving the page.

---

# 19. Responsive behavior

The app should work well from a phone because photographed receipts will commonly originate there.

Desktop:

* persistent sidebar
* larger document tables
* side-by-side document review

Mobile:

* collapsible navigation drawer
* cards instead of wide tables
* stacked document preview/editing
* highly visible upload action

---

# 20. Technical architecture

```text
                         Internet
                            │
                            ▼
                    ┌──────────────┐
                    │    Vercel    │
                    │              │
                    │   Next.js    │
                    └──────┬───────┘
                           │
               ┌───────────┼────────────┐
               │           │            │
               ▼           ▼            ▼
          Neon Postgres  Cloudflare R2  GenAI API
               │           │
               │           │
               │           │
               └─────┬─────┘
                     │
               independent backups
                     │
                     ▼
                Backblaze B2
```

---

# 21. Application runtime

Use:

* Next.js
* TypeScript
* App Router
* React Server Components where suitable
* Server Actions and/or Route Handlers for backend operations
* SSR for authenticated application pages
* Vercel for deployment and runtime

The browser should never connect directly to Neon using database credentials.

All database access goes through server-side application code.

---

# 22. Backend-for-frontend

Next.js itself acts as the backend-for-frontend.

There is no separate backend service in V1.

Server responsibilities include:

* authentication
* authorization
* database access
* document upload coordination
* generation of storage URLs
* AI invocation
* validation
* document mutation
* report generation
* audit logging

This keeps the initial system small while retaining clear domain/service boundaries inside the codebase.

---

# 23. Suggested internal application structure

A reasonable structure is:

```text
src/
  app/
    (auth)/
    (app)/
      dashboard/
      documents/
      inbox/
      reports/
      categories/
      settings/
    api/

  components/
    layout/
    documents/
    reports/
    ui/

  server/
    auth/
    db/
    storage/
    ai/
    backup/
    documents/
    reports/

  domain/
    documents/
    expenses/
    categories/
    reports/

  lib/
```

UI code should not directly know how Neon, R2, B2 or the AI provider works.

Those integrations sit behind small server-side adapters.

---

# 24. PostgreSQL

Use Neon PostgreSQL provisioned through Vercel.

PostgreSQL stores all structured application state.

Examples:

* document records
* extracted metadata
* accepted metadata
* manual corrections
* categories
* report metadata
* processing state
* file references
* audit history
* hashes
* timestamps

Neon supports normal PostgreSQL `pg_dump` and `pg_restore`, which allows backups to remain portable rather than tied to Neon-specific restore tooling.

---

# 25. Initial data model

## Document

```text
id
type
status
originalFileId
sha256
createdAt
updatedAt
transactionDate
reviewedAt
```

## DocumentFile

```text
id
documentId
kind
storageProvider
bucket
objectKey
mimeType
size
sha256
createdAt
```

Possible `kind` values:

* ORIGINAL
* PREVIEW
* GENERATED_REPORT

---

## Expense

Receipt-specific bookkeeping information can live in a separate expense entity:

```text
id
documentId
supplierName
documentNumber
transactionDate
currency
subtotal
vat
total
categoryId
businessUsePercentage
notes
```

This prevents generic `Document` from eventually containing hundreds of fields relevant to only one document type.

---

## Extraction

```text
id
documentId
provider
model
schemaVersion
rawResult
normalizedResult
createdAt
```

This allows AI models and schemas to change later.

---

## Category

```text
id
name
description
active
sortOrder
```

---

## AuditEvent

```text
id
entityType
entityId
action
field
oldValue
newValue
source
createdAt
```

Possible sources:

* AI
* USER
* SYSTEM

This is particularly useful for financial metadata.

---

# 26. Manual corrections

Never overwrite the provenance of extracted information.

For example, if AI extracts:

```text
supplier = "Office Deopt"
```

and the user changes it to:

```text
supplier = "Office Depot"
```

the application should retain enough information to know that the currently accepted value was manually supplied.

A later AI reprocessing operation should not replace it.

---

# 27. Cloudflare R2

R2 stores primary application files.

Suggested object structure:

```text
documents/
  {documentId}/
    original
    preview.webp

reports/
  {year}/
    {month}/
      {reportId}.pdf
```

Do not put sensitive business information such as supplier names in object keys.

Use random IDs.

R2 exposes an S3-compatible API, allowing normal S3 clients and tooling to work against it.

The R2 bucket must remain private.

The application should issue short-lived signed URLs or proxy authorized downloads where appropriate.

---

# 28. Backblaze B2

B2 is the independent disaster-recovery destination.

It should not normally participate in user-facing application reads.

Suggested layout:

```text
backup/
  database/
    daily/
    weekly/
    monthly/

  objects/
    documents/
    reports/

  manifests/
```

This gives the backup system a very simple responsibility:

**preserve enough information to reconstruct the production system.**

B2 provides an S3-compatible API, so the backup workflow can use standard S3 tooling.

---

# 29. Backup architecture

Backup is run by **GitHub Actions**, independently of Vercel.

This separation is intentional.

A Vercel deployment problem should not prevent backups from running.

GitHub stores backup-only credentials as repository Actions secrets.

---

# 30. Neon backup

Run once each night.

Workflow:

```text
GitHub Action
      │
      ▼
connect to Neon
      │
      ▼
pg_dump
      │
      ▼
compressed/custom-format dump
      │
      ▼
SHA-256
      │
      ▼
upload to B2
      │
      ▼
verify B2 object
```

Example key:

```text
backup/database/daily/2026/09/12/database.dump
```

The backup should contain everything required to recreate the application's relational state.

Database migrations should separately live in Git.

---

# 31. R2 backup

Do not download and re-upload every R2 object every night.

The nightly workflow should synchronize only objects that are not already safely represented in B2.

Because original documents are immutable, this works particularly well.

Conceptually:

```text
List R2 objects
      │
      ▼
compare with backup manifest/B2
      │
      ▼
copy missing objects
      │
      ▼
verify size/hash
      │
      ▼
update manifest
```

The system should never consider the job successful merely because an upload command returned successfully.

At minimum verify:

* destination object exists
* expected size matches

Preferably verify a known checksum recorded when the original was first uploaded.

---

# 32. Backup manifest

Maintain a machine-readable backup manifest.

Example:

```json
{
  "objectKey": "documents/abc123/original",
  "sha256": "...",
  "size": 184392,
  "backedUpAt": "...",
  "source": "r2"
}
```

This makes backup verification deterministic instead of relying only on filenames.

---

# 33. Backup retention

Recommended initial policy:

### Database

* daily: 14 days
* weekly: 8 weeks
* monthly: long-term

### Original documents

Keep the independent copy for the full required document-retention period.

Do not automatically apply the same short retention policy used for database dumps to original accounting documents.

B2 supports lifecycle rules for automatically expiring objects according to configured policies.

---

# 34. Immutable backups

Consider enabling B2 Object Lock for protected backup data.

Object Lock can prevent objects from being changed or deleted until their retention period expires, protecting against accidental deletion or compromised credentials.

Use it deliberately because retention also means **you** cannot freely remove those objects before the configured period expires.

A reasonable setup may therefore use separate B2 buckets or prefixes/policies for:

* protected accounting documents
* rotating database backups

---

# 35. Restore process

A backup system is incomplete without a documented restore process.

Disaster recovery should be possible as follows:

```text
1. Create/recover Neon database
2. Apply required infrastructure/configuration
3. Restore latest verified PostgreSQL backup
4. Create/recover R2 bucket
5. Copy backed-up objects from B2 to R2
6. Configure application secrets
7. Deploy Next.js application
8. Run consistency verification
```

The application should eventually have a maintenance command that verifies:

* every DB document referencing an original has a corresponding R2 object
* object SHA-256 matches the stored hash
* backup representation exists in B2

---

# 36. Periodic restore testing

Creating backup files is insufficient evidence that recovery works.

A scheduled GitHub workflow should periodically:

1. select a database backup
2. restore it into an isolated temporary PostgreSQL database
3. perform basic consistency checks
4. report success/failure

This can initially be run less frequently than the nightly backup, for example monthly.

---

# 37. Authentication

Version 1 requires only one protected account.

The entire application except `/login` should require authentication.

Protection must cover:

* rendered pages
* Server Actions
* Route Handlers
* document downloads
* report downloads
* storage URL generation
* mutations
* AI endpoints
* administrative endpoints

Do not implement authentication only by hiding UI routes.

Authorization must be enforced server-side at every protected entry point.

---

# 38. Password configuration

Do **not** store the raw login password in source code.

And preferably do not store the raw password in Vercel environment variables either.

Instead generate a strong password and store its password hash:

```text
AUTH_PASSWORD_HASH
```

For example using Argon2id or bcrypt.

Also create an unrelated high-entropy secret:

```text
AUTH_SESSION_SECRET
```

This is used for session integrity/encryption.

The actual password is known by the user but does not need to be recoverable from Vercel.

---

# 39. Login flow

```text
POST /login
     │
     ▼
server receives password
     │
     ▼
verify against AUTH_PASSWORD_HASH
     │
     ├── invalid → reject
     │
     └── valid
           │
           ▼
      create session
           │
           ▼
      Secure HttpOnly cookie
```

Cookie properties should include:

* `HttpOnly`
* `Secure`
* `SameSite=Lax` or stricter where practical
* explicit expiry

The browser must never receive:

* password hash
* session signing secret
* database credentials
* R2 credentials
* B2 credentials
* AI credentials

---

# 40. Sessions

A server-verified cookie session is sufficient for V1.

A database session table is unnecessary for a single-user application unless features later require:

* multiple users
* session revocation
* device management
* login history

Keep the authentication implementation behind an internal API so it can later be replaced by:

* Auth.js
* Google authentication
* passkeys
* another identity provider

without rewriting application pages.

---

# 41. Route protection

The route hierarchy can make the distinction explicit:

```text
app/
  (public)/
    login/

  (protected)/
    dashboard/
    documents/
    inbox/
    reports/
    settings/
```

A middleware/proxy layer can reject or redirect obviously unauthenticated page requests early.

But middleware must not be the sole security boundary.

Sensitive server operations should call a shared function such as:

```text
requireSession()
```

before accessing data.

---

# 42. Private document access

Neither R2 nor B2 should expose a public bucket.

A document preview/download should follow:

```text
Browser
   │
   ▼
Next.js
   │
   ├── verify session
   ├── verify document exists
   └── create temporary signed R2 URL
                    │
                    ▼
                 Browser
```

Signed URLs should expire quickly.

The B2 backup bucket should never be exposed through the application UI.

---

# 43. CSRF and mutations

State-changing actions should use server-side mechanisms that preserve same-origin protections.

Do not create unauthenticated generic HTTP endpoints for:

* delete
* edit
* approve
* upload
* reprocess

If Route Handlers are used, validate:

* authentication
* input
* method
* origin where relevant

---

# 44. Login abuse protection

Even a private application should defend its public `/login` endpoint.

Initial measures:

* strong password
* rate limiting
* generic login failure message
* no account-name enumeration
* short delay/backoff after repeated failures if needed

Because there is only one user, there is little justification for exposing usernames at all.

The login form can simply ask for:

**Password**

---

# 45. Secrets

## Vercel environment variables

Application runtime secrets:

```text
DATABASE_URL

AUTH_PASSWORD_HASH
AUTH_SESSION_SECRET

R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET

AI_API_KEY
```

The application should **not** receive B2 backup credentials unless some future runtime feature genuinely needs B2.

---

## GitHub Actions secrets

Backup environment:

```text
NEON_BACKUP_DATABASE_URL

R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET

B2_ENDPOINT
B2_ACCESS_KEY_ID
B2_SECRET_ACCESS_KEY
B2_BUCKET
```

Credentials should use the minimum permissions required.

The application should not possess credentials capable of deleting backup data.

This separates a compromised web application from its disaster-recovery copy.

---

# 46. AI provider boundary

AI integration should be behind an interface such as:

```text
DocumentAnalyzer
```

Conceptually:

```text
analyze(document): DocumentExtraction
```

The rest of the product should not depend directly on one AI vendor's response format.

This makes it possible to change:

* provider
* model
* prompt
* extraction schema

without changing the database/reporting system.

---

# 47. AI safety for bookkeeping data

AI output should never directly become accepted financial data without validation.

Validate at minimum:

* date format
* currency
* numbers
* subtotal/VAT/total consistency
* allowed document types
* allowed categories

AI-generated values should have clear provenance.

For questionable extraction, prefer:

```text
NEEDS_REVIEW
```

over guessing.

---

# 48. Audit history

Financial edits should produce lightweight audit events.

Examples:

```text
AI extracted total: 156.20

User changed total:
156.20 → 158.20
```

Useful events include:

* upload
* extraction
* reprocessing
* manual edit
* category change
* approval
* deletion/archive
* report generation

This provides accountability without building a full accounting ledger.

---

# 49. Deletion semantics

Avoid immediate hard deletion of business documents through normal UI actions.

Prefer:

```text
Archive
```

or a recoverable soft deletion state.

Permanent deletion can exist as a separate deliberate operation.

Backup retention may mean an independently backed-up copy remains available even after production deletion.

---

# 50. Reports as derived data

The database should contain the authoritative bookkeeping information.

A monthly report is derived from that data.

If a report can be regenerated exactly, storing every generated version is optional.

If a report represents an officially exported snapshot sent to an accountant, store it as an immutable generated artifact with:

* report ID
* reporting period
* generated timestamp
* file hash
* source/query version

This makes it possible to distinguish:

**the current state of March**

from

**the March report that was generated and sent on April 2**.

---

# 51. Observability

The application should have lightweight operational logging.

Important failures include:

* upload failure
* R2 write failure
* AI processing failure
* database failure
* report generation failure
* backup failure
* restore-test failure

Never log:

* passwords
* session secrets
* database URLs
* storage credentials
* complete sensitive document contents

---

# 52. Health information visible to the user

The product does not need an operations dashboard initially.

But Settings may eventually show simple indicators:

```text
Database                  Connected
Primary document storage  Connected
Last successful backup    Sep 12, 2026
```

Backup details themselves should come from trustworthy backup metadata rather than assuming yesterday's scheduled workflow succeeded.

---

# 53. GitHub Actions backup workflow

Recommended jobs:

```text
backup.yml

┌───────────────────────────┐
│ Backup PostgreSQL         │
│ pg_dump → B2 → verify     │
└───────────────────────────┘

┌───────────────────────────┐
│ Synchronize R2 → B2       │
│ missing objects → verify  │
└───────────────────────────┘

┌───────────────────────────┐
│ Write backup manifest     │
└───────────────────────────┘
```

A failure in either primary backup operation should fail the workflow.

GitHub notification mechanisms can then make failures visible.

---

# 54. Why GitHub Actions instead of application cron

Vercel supports scheduled cron invocations and recommends protecting cron handlers using a `CRON_SECRET`.

However, backups are intentionally placed outside Vercel.

This gives the system failure independence:

```text
Production runtime    → Vercel
Primary database      → Neon
Primary object store  → Cloudflare
Backup scheduler      → GitHub
Backup storage        → Backblaze
```

A problem affecting one provider is less likely to compromise the complete recovery path.

---

# 55. Database migrations

All schema changes should be migrations committed to Git.

Never make production schema edits that exist only in a provider dashboard.

Recovery then consists of two complementary sources:

```text
Git
 └── application + migrations

B2
 ├── database state
 └── documents
```

---

# 56. Environment separation

At minimum support:

* local development
* Vercel Preview
* Vercel Production

Production financial data should not be copied automatically into preview deployments.

Preview should use:

* separate database
* separate R2 bucket/prefix
* separate auth secret

or deliberately mocked/sample data.

---

# 57. Initial non-goals

V1 does not need:

* multi-tenant architecture
* billing
* complex RBAC
* accounting-system synchronization
* automatic bank reconciliation
* OCR infrastructure managed by us
* custom object storage
* custom database hosting
* Kubernetes
* background worker fleet
* event bus
* microservices

These can be introduced only when a concrete requirement justifies them.

---

# 58. Recommended V1 technology stack

```text
Frontend + BFF
  Next.js + TypeScript

Hosting
  Vercel

Database
  Neon PostgreSQL

ORM / query layer
  Choose one lightweight PostgreSQL-compatible layer
  such as Drizzle or Prisma

Primary file storage
  Cloudflare R2

Disaster-recovery storage
  Backblaze B2

AI
  External multimodal GenAI API behind DocumentAnalyzer

Backup scheduler
  GitHub Actions

Source control
  GitHub
```

---

# 59. V1 feature scope

A good first production release consists of:

### Authentication

* password login
* secure session
* logout
* full server-side protection

### Documents

* upload image/PDF
* immutable original storage
* document listing
* detail/preview
* archive

### AI

* automatic extraction
* normalized fields
* confidence/review flow
* reprocess

### Bookkeeping

* manual corrections
* categories
* monthly assignment
* expense metadata

### UX

* application shell
* header
* sidebar
* dashboard
* inbox
* documents
* reports
* responsive/mobile UI

### Reporting

* monthly summary
* category totals
* CSV export
* printable/PDF report

### Reliability

* R2 primary documents
* Neon primary database
* nightly Neon → B2 backup
* nightly R2 → B2 synchronization
* checksum verification
* backup retention
* restore documentation

---

# 60. Suggested development stages

## Stage 1 — Foundation

Build:

* Next.js shell
* login/session
* PostgreSQL connectivity
* R2 integration
* schema/migrations
* protected routes

At the end of this stage, uploading and retrieving a private document should already work securely.

---

## Stage 2 — Document management

Build:

* upload
* Documents page
* document detail
* previews
* statuses
* duplicate hashes
* archive

---

## Stage 3 — AI processing

Build:

* DocumentAnalyzer abstraction
* extraction schema
* processing states
* review workflow
* manual correction behavior

---

## Stage 4 — Expense workflow

Build:

* normalized expense model
* categories
* Inbox
* filters
* Dashboard

---

## Stage 5 — Reporting

Build:

* monthly views
* totals
* exports
* generated report artifacts

---

## Stage 6 — Disaster recovery

Before considering V1 complete:

* PostgreSQL backup workflow
* R2 synchronization
* B2 configuration
* manifest/checksum verification
* retention rules
* restore procedure
* successful restore test

Backup is therefore part of the V1 definition of done, not a later infrastructure enhancement.

---

# 61. Definition of done for V1

The first version is ready when the user can:

1. Log in securely.
2. Upload a photographed or digital receipt.
3. Leave the application while processing continues or completes independently of that page.
4. Return and find the document.
5. See the original document.
6. See AI-extracted bookkeeping information.
7. Correct any extracted value.
8. Categorize the expense.
9. Browse and search historical documents.
10. See a monthly overview.
11. Export a monthly report.
12. Log out.
13. Access none of the above without authentication.

And operationally:

1. Every accepted original exists in R2.
2. Every original has a recorded SHA-256.
3. PostgreSQL contains the authoritative metadata and corrections.
4. Nightly PostgreSQL backups reach B2.
5. R2 documents are independently represented in B2.
6. Backup jobs verify what they write.
7. Failures cause the GitHub Action to fail visibly.
8. A documented restoration procedure exists.
9. At least one real restoration test has succeeded.

---

# 62. Final architecture

```text
                           USER
                            │
                            │ HTTPS
                            ▼
                   ┌─────────────────┐
                   │     Vercel      │
                   │                 │
                   │ Next.js         │
                   │ SSR + React     │
                   │ BFF             │
                   │ Auth            │
                   └───┬─────┬───────┘
                       │     │
              ┌────────┘     └──────────┐
              │                         │
              ▼                         ▼
      ┌──────────────┐          ┌──────────────┐
      │ Neon         │          │ Cloudflare   │
      │ PostgreSQL   │          │ R2           │
      │              │          │              │
      │ metadata     │          │ originals    │
      │ corrections  │          │ previews     │
      │ bookkeeping  │          │ reports      │
      │ audit        │          │              │
      └──────┬───────┘          └──────┬───────┘
             │                         │
             │                         │
             │        ┌────────────────┘
             │        │
             ▼        ▼
       ┌─────────────────────┐
       │    GitHub Actions   │
       │                     │
       │ nightly backup      │
       │ verification        │
       │ restore testing     │
       └──────────┬──────────┘
                  │
                  ▼
          ┌─────────────────┐
          │  Backblaze B2   │
          │                 │
          │ DB dumps        │
          │ document copy   │
          │ report copy     │
          │ manifests       │
          └─────────────────┘
```

The result is deliberately small: one Next.js application, one managed relational database, one primary object store, and one independent backup destination.

The product remains simple for one user while the domain boundaries — particularly **Document**, **Expense**, **Extraction**, and **Report** — leave room for the application to become a broader business-document manager later without replacing its foundation.
