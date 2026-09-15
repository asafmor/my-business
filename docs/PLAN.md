# My Business — Implementation Task Tree

## Dependency model

Interpret this document like a Linux filesystem:

```text
parent/
├── child-a/
├── child-b/
└── child-c/
```

`child-a`, `child-b`, and `child-c` all depend on `parent`, but can normally be implemented in parallel.

Explicit dependencies that cross branches are written as:

```text
↳ depends on: path/to/task
```

A task is considered complete only when its implementation, automated tests where applicable, and required configuration/documentation are complete.

---

# 0-project-bootstrap/

```text
0-project-bootstrap/
├── 0.1-repository/
│   ├── create-github-repository
│   ├── initialize-nextjs-typescript-project
│   ├── configure-app-router
│   ├── configure-package-manager
│   ├── add-readme
│   └── define-branch-strategy
│
├── 0.2-code-quality/
│   ├── configure-typescript-strict-mode
│   ├── configure-eslint
│   ├── configure-formatting
│   ├── add-typecheck-command
│   ├── add-lint-command
│   ├── add-test-command
│   └── add-build-validation-command
│
├── 0.3-project-structure/
│   ├── create-app-route-groups
│   │   ├── public
│   │   └── protected
│   ├── create-components
│   │   ├── layout
│   │   ├── ui
│   │   ├── documents
│   │   └── reports
│   ├── create-server
│   │   ├── auth
│   │   ├── db
│   │   ├── storage
│   │   ├── ai
│   │   ├── documents
│   │   └── reports
│   ├── create-domain
│   │   ├── documents
│   │   ├── expenses
│   │   ├── categories
│   │   └── reports
│   └── create-lib
│
└── 0.4-ci-foundation/
    ├── create-ci-workflow
    ├── run-typecheck
    ├── run-lint
    ├── run-tests
    └── run-production-build
```

---

# 1-cloud-foundation/

```text
1-cloud-foundation/
├── 1.1-vercel/
│   ├── create-vercel-project
│   ├── connect-github-repository
│   ├── configure-production-environment
│   ├── configure-development-environment
│   ├── restrict-automatic-deployments-to-main
│   └── verify-production-deployments
│
├── 1.2-neon/
│   ├── provision-neon-postgres
│   ├── connect-neon-to-vercel
│   ├── configure-production-database-url
│   ├── provision-isolated-development-database
│   ├── configure-development-database-url
│   ├── define-connection-pooling-strategy
│   ├── reserve-direct-database-url-for-backups
│   └── verify-server-side-connectivity
│
├── 1.3-r2/
│   ├── create-private-r2-bucket
│   ├── create-private-development-r2-bucket
│   ├── create-application-service-credentials
│   ├── limit-credentials-to-required-permissions
│   ├── configure-vercel-r2-secrets
│   ├── configure-development-r2-secrets
│   ├── configure-cors-if-required
│   └── verify-private-object-read-write
│
├── 1.4-b2/
│   ├── create-private-backup-bucket
│   ├── create-github-actions-backup-credentials
│   ├── restrict-credentials-to-backup-requirements
│   ├── configure-lifecycle-policy
│   ├── evaluate-object-lock
│   └── verify-s3-compatible-access
│
└── 1.5-environment-isolation/
    ├── define-isolated-local-development-environment
    ├── define-isolated-vercel-development-environment
    ├── keep-preview-cloud-environments-disabled
    ├── define-production-environment
    └── prevent-production-data-from-development-use
```

---

# 2-domain-and-database-foundation/

```text
2-domain-and-database-foundation/
├── 2.1-database-layer/
│   ├── select-query-layer
│   │   └── drizzle-or-prisma
│   ├── configure-database-client
│   ├── configure-migration-tooling
│   ├── create-migration-command
│   └── ensure-migrations-run-outside-request-path
│
├── 2.2-document-schema/
│   ├── create-document-table
│   │   ├── id
│   │   ├── type
│   │   ├── status
│   │   ├── original-file-id
│   │   ├── sha256
│   │   ├── transaction-date
│   │   ├── reviewed-at
│   │   ├── created-at
│   │   └── updated-at
│   │
│   ├── create-document-file-table
│   │   ├── id
│   │   ├── document-id
│   │   ├── kind
│   │   ├── storage-provider
│   │   ├── bucket
│   │   ├── object-key
│   │   ├── mime-type
│   │   ├── size
│   │   ├── sha256
│   │   └── created-at
│   │
│   └── define-document-enums
│       ├── document-type
│       ├── document-status
│       └── file-kind
│
├── 2.3-expense-schema/
│   ├── create-expense-table
│   │   ├── document-id
│   │   ├── supplier-name
│   │   ├── document-number
│   │   ├── transaction-date
│   │   ├── currency
│   │   ├── subtotal
│   │   ├── vat
│   │   ├── total
│   │   ├── category-id
│   │   ├── business-use-percentage
│   │   └── notes
│   │
│   └── define-money-storage-strategy
│
├── 2.4-category-schema/
│   ├── create-category-table
│   ├── support-active-inactive-state
│   ├── add-sort-order
│   └── create-default-expense-categories
│
├── 2.5-extraction-schema/
│   ├── create-extraction-table
│   ├── store-provider
│   ├── store-model
│   ├── store-schema-version
│   ├── store-raw-result
│   ├── store-normalized-result
│   └── preserve-extraction-history
│
├── 2.6-audit-schema/
│   ├── create-audit-event-table
│   ├── support-entity-type
│   ├── support-entity-id
│   ├── support-action
│   ├── support-field
│   ├── support-old-value
│   ├── support-new-value
│   └── support-source
│       ├── AI
│       ├── USER
│       └── SYSTEM
│
├── 2.7-report-schema/
│   ├── create-report-record
│   ├── reporting-period
│   ├── generation-time
│   ├── source-version
│   ├── file-reference
│   └── file-hash
│
├── 2.8-indexes/
│   ├── transaction-date-index
│   ├── supplier-index
│   ├── status-index
│   ├── category-index
│   ├── document-type-index
│   ├── sha256-index
│   └── report-period-index
│
└── 2.9-domain-services/
    ├── document-domain-types
    ├── expense-domain-types
    ├── category-domain-types
    ├── report-domain-types
    └── validation-schemas
```

---

# 3-authentication-and-security/

```text
3-authentication-and-security/
├── 3.1-secret-generation/
│   ├── generate-strong-login-password
│   ├── generate-password-hash
│   ├── choose-argon2id-or-bcrypt
│   ├── generate-auth-session-secret
│   └── configure-vercel-environment-variables
│       ├── AUTH_PASSWORD_HASH
│       └── AUTH_SESSION_SECRET
│
├── 3.2-auth-service/
│   ├── implement-password-verification
│   ├── implement-session-creation
│   ├── implement-session-validation
│   ├── implement-session-expiry
│   ├── implement-session-destruction
│   └── implement-require-session
│
├── 3.3-session-cookie/
│   ├── httponly
│   ├── secure
│   ├── same-site
│   ├── explicit-expiration
│   └── signed-or-encrypted-session-content
│
├── 3.4-login-ui/
│   ├── create-login-page
│   ├── password-only-form
│   ├── generic-invalid-login-error
│   ├── redirect-authenticated-user
│   └── redirect-successful-login-to-dashboard
│
├── 3.5-route-protection/
│   ├── protect-app-pages
│   ├── protect-server-actions
│   ├── protect-route-handlers
│   ├── protect-storage-url-generation
│   ├── protect-report-downloads
│   └── protect-ai-actions
│
├── 3.6-login-abuse-protection/
│   ├── add-rate-limiting
│   ├── avoid-user-enumeration
│   └── define-failed-login-logging
│
├── 3.7-mutation-security/
│   ├── validate-authentication
│   ├── validate-input
│   ├── enforce-http-methods
│   ├── enforce-origin-where-needed
│   └── review-csrf-properties
│
└── 3.8-security-tests/
    ├── unauthenticated-page-access-is-rejected
    ├── unauthenticated-api-access-is-rejected
    ├── unauthenticated-document-access-is-rejected
    ├── expired-session-is-rejected
    └── logout-invalidates-session
```

---

# 4-application-shell/

```text
4-application-shell/
├── 4.1-layout/
│   ├── authenticated-root-layout
│   ├── header
│   ├── sidebar
│   └── main-content-region
│
├── 4.2-header/
│   ├── application-identity
│   ├── global-upload-action
│   ├── optional-global-search-placeholder
│   ├── user-indicator
│   └── logout-action
│
├── 4.3-sidebar/
│   ├── dashboard-link
│   ├── documents-link
│   ├── upload-tray-link
│   ├── reports-link
│   ├── categories-link
│   └── settings-link
│
├── 4.4-responsive-navigation/
│   ├── desktop-persistent-sidebar
│   ├── mobile-navigation-drawer
│   ├── mobile-header-trigger
│   └── preserve-active-navigation-state
│
├── 4.5-ui-foundation/
│   ├── typography
│   ├── spacing-system
│   ├── forms
│   ├── buttons
│   ├── tables
│   ├── cards
│   ├── dialogs
│   ├── badges
│   ├── loading-states
│   ├── empty-states
│   └── error-states
│
└── 4.6-accessibility/
    ├── keyboard-navigation
    ├── focus-management
    ├── form-labels
    ├── semantic-layout
    └── accessible-status-messages
```

---

# 5-primary-document-storage/

```text
5-primary-document-storage/
├── 5.1-storage-adapter/
│   ├── define-object-storage-interface
│   ├── implement-r2-adapter
│   ├── upload-object
│   ├── object-exists
│   ├── get-object-metadata
│   ├── create-signed-read-url
│   └── delete-or-archive-internal-operation
│
├── 5.2-object-key-strategy/
│   ├── random-document-identifiers
│   ├── documents-document-id-original
│   ├── documents-document-id-preview
│   ├── reports-year-month-report-id
│   └── prohibit-sensitive-data-in-object-keys
│
├── 5.3-file-validation/
│   ├── allowed-mime-types
│   │   ├── jpeg
│   │   ├── png
│   │   ├── webp
│   │   └── pdf
│   ├── maximum-file-size
│   ├── reject-empty-files
│   └── validate-detected-file-type
│
├── 5.4-hashing/
│   ├── calculate-sha256
│   ├── persist-sha256
│   └── reuse-hash-for-duplicate-detection
│
├── 5.5-original-file-policy/
│   ├── immutable-originals
│   ├── never-replace-original-with-preview
│   ├── never-replace-original-with-ai-output
│   └── record-original-file-metadata
│
└── 5.6-private-access/
    ├── bucket-remains-private
    ├── require-session-before-access
    ├── generate-short-lived-signed-url
    └── ensure-b2-is-never-used-for-normal-app-serving
```

---

# 6-document-upload-pipeline/

```text
6-document-upload-pipeline/
├── 6.1-upload-api/
│   ├── authenticated-upload-entrypoint
│   ├── validate-files
│   ├── support-single-file
│   ├── support-multiple-files
│   └── return-per-file-result
│
├── 6.2-ingestion/
│   ├── generate-document-id
│   ├── calculate-sha256
│   ├── detect-exact-duplicate
│   ├── upload-original-to-r2
│   ├── create-document-file-record
│   ├── create-document-record
│   ├── set-status-uploaded
│   └── emit-audit-event
│
├── 6.3-duplicate-handling/
│   ├── exact-hash-match
│   ├── warn-user
│   ├── do-not-auto-delete
│   └── allow-user-decision
│
├── 6.4-upload-ui/
│   ├── drag-and-drop
│   ├── file-picker
│   ├── mobile-photo-picker
│   ├── multi-file-selection
│   ├── per-file-progress-card
│   ├── successful-upload-state
│   ├── failed-upload-state
│   └── allow-leaving-page-after-upload
│
└── 6.5-upload-tests/
    ├── valid-image-upload
    ├── valid-pdf-upload
    ├── unsupported-file-rejected
    ├── duplicate-detected
    ├── db-failure-does-not-create-inconsistent-state
    └── storage-failure-does-not-create-false-success
```

---

# 7-document-processing-and-ai/

```text
7-document-processing-and-ai/
├── 7.1-ai-abstraction/
│   ├── define-document-analyzer-interface
│   ├── define-input-contract
│   ├── define-output-schema
│   └── isolate-provider-specific-code
│
├── 7.2-provider-implementation/
│   ├── configure-ai-api-key
│   ├── send-document-to-multimodal-model
│   ├── enforce-structured-response
│   ├── capture-provider
│   ├── capture-model
│   └── handle-provider-errors
│
├── 7.3-normalized-extraction-schema/
│   ├── document-type
│   ├── supplier-name
│   ├── supplier-identifier
│   ├── document-number
│   ├── transaction-date
│   ├── currency
│   ├── subtotal
│   ├── vat
│   ├── total
│   ├── payment-method
│   ├── line-items
│   ├── suggested-category
│   ├── description
│   ├── confidence
│   └── anomalies
│
├── 7.4-validation/
│   ├── validate-date
│   ├── validate-currency
│   ├── validate-numeric-values
│   ├── validate-document-type
│   ├── validate-category
│   ├── validate-subtotal-vat-total-consistency
│   └── convert-invalid-or-uncertain-data-to-review-state
│
├── 7.5-processing-state-machine/
│   ├── uploaded-to-processing
│   ├── processing-to-ready
│   ├── processing-to-needs-review
│   ├── processing-to-failed
│   └── support-reprocessing
│
├── 7.6-persistence/
│   ├── retain-raw-ai-response
│   ├── retain-normalized-result
│   ├── retain-schema-version
│   ├── create-expense-data
│   └── emit-audit-events
│
├── 7.7-human-authority-rules/
│   ├── distinguish-ai-value-from-accepted-value
│   ├── mark-user-corrected-fields
│   ├── prevent-reprocessing-from-overwriting-manual-values
│   └── preserve-ai-provenance
│
└── 7.8-processing-tests/
    ├── successful-extraction
    ├── invalid-ai-json
    ├── missing-required-information
    ├── inconsistent-vat
    ├── ai-provider-failure
    ├── low-confidence-review-state
    └── reprocessing-preserves-manual-corrections
```

---

# 8-background-processing/

```text
8-background-processing/
├── 8.1-processing-execution-model/
│   ├── choose-v1-background-execution-mechanism
│   ├── ensure-processing-does-not-depend-on-browser-remaining-open
│   ├── persist-processing-state
│   └── make-processing-idempotent
│
├── 8.2-retry-policy/
│   ├── classify-retryable-failures
│   ├── bounded-retries
│   ├── avoid-duplicate-extraction-records
│   └── terminal-failed-state
│
├── 8.3-status-refresh/
│   ├── refresh-processing-status-in-ui
│   ├── stop-refreshing-terminal-states
│   └── expose-retry-action-for-failed-documents
│
└── 8.4-idempotency/
    ├── duplicate-processing-request-safe
    ├── repeated-callback-safe
    └── re-run-safe-after-server-failure
```

---

# 9-document-management-ui/

```text
9-document-management-ui/
├── 9.1-documents-page/
│   ├── fetch-documents
│   ├── newest-first-default-order
│   ├── desktop-table
│   │   ├── preview
│   │   ├── date
│   │   ├── supplier
│   │   ├── type
│   │   ├── category
│   │   ├── total
│   │   ├── vat
│   │   └── status
│   └── mobile-card-layout
│
├── 9.2-search/
│   ├── free-text
│   ├── supplier
│   └── normalize-search-query
│
├── 9.3-filters/
│   ├── date-range
│   ├── month
│   ├── document-type
│   ├── category
│   ├── amount-range
│   └── status
│
├── 9.4-url-state/
│   ├── encode-search-in-url
│   ├── encode-filters-in-url
│   ├── encode-sort-in-url
│   └── preserve-browser-navigation
│
├── 9.5-document-detail/
│   ├── document-preview
│   ├── extracted-data-panel
│   ├── editable-fields
│   ├── validation-errors
│   ├── review-indicators
│   ├── manual-correction-indicators
│   ├── save-action
│   ├── mark-reviewed-action
│   ├── reprocess-action
│   └── archive-action
│
├── 9.6-document-detail-desktop/
│   ├── side-by-side-preview-and-fields
│   └── sticky-or-convenient-document-preview
│
├── 9.7-document-detail-mobile/
│   ├── stacked-preview-and-fields
│   └── mobile-friendly-editing
│
└── 9.8-advanced-detail-sections/
    ├── extraction-history
    ├── raw-extraction-debug-view
    ├── file-metadata
    └── audit-history
```

---

# 10-bookkeeping-workflow/

```text
10-bookkeeping-workflow/
├── 10.1-expense-editing/
│   ├── supplier
│   ├── transaction-date
│   ├── document-number
│   ├── currency
│   ├── subtotal
│   ├── vat
│   ├── total
│   ├── category
│   ├── business-use-percentage
│   ├── notes
│   └── payment-method-if-supported
│
├── 10.2-category-management/
│   ├── list-categories
│   ├── create-category
│   ├── edit-category
│   ├── activate-deactivate-category
│   ├── reorder-category
│   └── protect-referenced-category-history
│
├── 10.3-review-rules/
│   ├── missing-amount
│   ├── missing-date
│   ├── uncertain-supplier
│   ├── invalid-total-calculation
│   ├── suspicious-vat
│   ├── possible-duplicate
│   └── unsupported-or-failed-processing
│
├── 10.4-review-completion/
│   ├── mark-ready
│   ├── record-reviewed-at
│   └── audit-user-review
│
└── 10.5-archive-semantics/
    ├── archive-instead-of-normal-hard-delete
    ├── hide-archived-by-default
    ├── allow-viewing-archived
    └── keep-permanent-delete-as-separate-administrative-operation
```

---

# 11-upload-tray/

```text
11-upload-tray/
├── 11.1-upload-tray-query/
│   ├── needs-review
│   ├── processing
│   ├── failed
│   └── recently-completed
│
├── 11.2-attention-reasons/
│   ├── generate-human-readable-review-reason
│   ├── missing-information
│   ├── inconsistent-values
│   ├── duplicate-warning
│   └── extraction-failure
│
├── 11.3-inline-actions/
│   ├── approve
│   ├── edit-common-fields
│   ├── retry-processing
│   └── open-document-detail
│
└── 11.4-live-status/
    ├── reflect-processing-completion
    └── avoid-full-page-reload-where-practical
```

---

# 12-dashboard/

```text
12-dashboard/
├── 12.1-current-month-summary/
│   ├── total-expenses
│   ├── vat-total
│   ├── document-count
│   └── needs-review-count
│
├── 12.2-needs-attention/
│   ├── recent-review-items
│   └── link-to-tray
│
├── 12.3-recent-documents/
│   ├── recently-uploaded
│   └── recently-edited
│
├── 12.4-category-summary/
│   └── expense-breakdown-by-category
│
├── 12.5-quick-actions/
│   ├── upload-document
│   ├── open-tray
│   └── open-monthly-report
│
└── 12.6-empty-state/
    └── guide-first-upload
```

---

# 13-reporting/

```text
13-reporting/
├── 13.1-monthly-query-layer/
│   ├── document-count
│   ├── gross-expense-total
│   ├── net-total
│   ├── vat-total
│   ├── category-breakdown
│   ├── supplier-breakdown
│   └── review-problem-count
│
├── 13.2-monthly-report-ui/
│   ├── month-selector
│   ├── summary
│   ├── category-breakdown
│   ├── supplier-breakdown
│   ├── problematic-documents
│   └── navigate-previous-next-month
│
├── 13.3-csv-export/
│   ├── define-stable-column-schema
│   ├── generate-csv
│   ├── correct-character-encoding
│   └── authenticated-download
│
├── 13.4-excel-compatible-export/
│   └── ensure-csv-opens-cleanly-in-spreadsheet-applications
│
├── 13.5-pdf-report/
│   ├── create-printable-layout
│   ├── generate-pdf
│   ├── store-as-generated-artifact
│   ├── calculate-file-hash
│   └── create-report-record
│
├── 13.6-report-snapshot-semantics/
│   ├── separate-live-month-view-from-generated-report
│   ├── record-generation-time
│   ├── record-source-version
│   └── preserve-sent-generated-report
│
└── 13.7-report-tests/
    ├── totals-match-source-data
    ├── filters-do-not-change-official-period-unexpectedly
    ├── archived-data-policy-is-consistent
    └── generated-report-is-reproducible-or-versioned
```

---

# 14-settings/

```text
14-settings/
├── 14.1-general/
│   ├── application-information
│   └── future-configuration-placeholder
│
├── 14.2-system-status/
│   ├── database-status
│   ├── primary-storage-status
│   └── last-successful-backup
│
├── 14.3-categories-link/
│   └── category-configuration
│
└── 14.4-security/
    └── logout-all-or-password-change-placeholder-for-future-auth-system
```

---

# 15-audit-history/

```text
15-audit-history/
├── 15.1-event-generation/
│   ├── upload
│   ├── ai-extraction
│   ├── ai-reprocessing
│   ├── manual-edit
│   ├── category-change
│   ├── review
│   ├── archive
│   └── report-generation
│
├── 15.2-field-change-events/
│   ├── old-value
│   ├── new-value
│   └── source
│
└── 15.3-document-history-ui/
    ├── chronological-events
    ├── human-readable-diffs
    └── keep-advanced-history-collapsed-by-default
```

---

# 16-backup-foundation/

```text
16-backup-foundation/
├── 16.1-github-secrets/
│   ├── NEON_BACKUP_DATABASE_URL
│   ├── R2_ACCOUNT_ID
│   ├── R2_ACCESS_KEY_ID
│   ├── R2_SECRET_ACCESS_KEY
│   ├── R2_BUCKET
│   ├── B2_ENDPOINT
│   ├── B2_ACCESS_KEY_ID
│   ├── B2_SECRET_ACCESS_KEY
│   └── B2_BUCKET
│
├── 16.2-permission-separation/
│   ├── application-has-no-b2-backup-delete-credentials
│   ├── github-owns-backup-credentials
│   ├── use-least-privilege-r2-backup-credentials
│   └── use-least-privilege-neon-backup-credentials
│
├── 16.3-backup-layout/
│   ├── database-daily
│   ├── database-weekly
│   ├── database-monthly
│   ├── objects-documents
│   ├── objects-reports
│   └── manifests
│
└── 16.4-nightly-workflow/
    ├── schedule-nightly
    ├── manual-workflow-dispatch
    ├── fail-job-on-backup-error
    └── retain-useful-job-logs-without-secrets
```

---

# 17-database-backup/

```text
17-database-backup/
├── 17.1-pg-dump/
│   ├── install-compatible-postgresql-client
│   ├── connect-to-neon
│   ├── generate-complete-restorable-dump
│   ├── use-portable-dump-format
│   └── ensure-command-fails-on-error
│
├── 17.2-backup-file/
│   ├── timestamp-file
│   ├── calculate-sha256
│   ├── record-size
│   └── avoid-secrets-in-filename
│
├── 17.3-upload-to-b2/
│   ├── upload-dump
│   ├── upload-checksum-or-manifest
│   ├── verify-object-exists
│   └── verify-size
│
├── 17.4-retention/
│   ├── daily-14-days
│   ├── weekly-8-weeks
│   └── monthly-long-term
│
└── 17.5-database-backup-tests/
    ├── intentionally-failed-pg-dump-fails-workflow
    ├── failed-b2-upload-fails-workflow
    └── corrupt-or-missing-verification-fails-workflow
```

---

# 18-r2-to-b2-backup/

```text
18-r2-to-b2-backup/
├── 18.1-object-inventory/
│   ├── list-r2-source-objects
│   ├── capture-size
│   ├── capture-object-key
│   └── obtain-or-reference-sha256
│
├── 18.2-backup-comparison/
│   ├── inspect-existing-b2-copy
│   ├── inspect-backup-manifest
│   └── identify-missing-or-invalid-objects
│
├── 18.3-incremental-copy/
│   ├── copy-only-required-objects
│   ├── preserve-object-key-mapping
│   └── avoid-full-nightly-recopy
│
├── 18.4-verification/
│   ├── verify-destination-exists
│   ├── verify-size
│   ├── verify-sha256-where-available
│   └── fail-workflow-on-mismatch
│
├── 18.5-manifest/
│   ├── object-key
│   ├── sha256
│   ├── size
│   ├── backed-up-at
│   └── source
│
└── 18.6-object-retention/
    ├── preserve-accounting-documents-long-term
    ├── separate-original-document-retention-from-db-retention
    └── configure-object-lock-if-selected
```

---

# 19-backup-observability/

```text
19-backup-observability/
├── 19.1-backup-result-metadata/
│   ├── last-database-backup
│   ├── last-object-backup
│   ├── last-verification
│   └── backup-status
│
├── 19.2-failure-notification/
│   ├── github-action-failure-visible
│   └── configure-email-or-other-notification-if-desired
│
├── 19.3-settings-integration/
│   ├── expose-last-successful-backup
│   └── do-not-assume-scheduled-job-equals-success
│
└── 19.4-secret-safe-logging/
    ├── redact-database-url
    ├── redact-storage-credentials
    └── avoid-document-content-in-backup-logs
```

---

# 20-disaster-recovery/

```text
20-disaster-recovery/
├── 20.1-restore-documentation/
│   ├── provision-new-neon
│   ├── restore-database
│   ├── provision-new-r2-bucket
│   ├── restore-r2-objects-from-b2
│   ├── configure-vercel-secrets
│   ├── deploy-application
│   └── run-consistency-check
│
├── 20.2-database-restore-command/
│   ├── download-selected-b2-backup
│   ├── verify-sha256
│   ├── restore-with-pg-restore
│   └── validate-schema-and-data
│
├── 20.3-object-restore-command/
│   ├── enumerate-b2-backup
│   ├── restore-to-r2
│   ├── preserve-object-keys
│   └── verify-restored-files
│
├── 20.4-consistency-verifier/
│   ├── every-document-original-reference-exists-in-r2
│   ├── every-r2-original-hash-matches-db
│   ├── every-required-original-exists-in-b2
│   └── report-orphaned-objects
│
└── 20.5-restore-test/
    ├── perform-real-test-restore
    ├── verify-document-queries
    ├── verify-expense-data
    ├── verify-manual-corrections
    ├── verify-audit-history
    └── document-test-result
```

---

# 21-scheduled-restore-testing/

```text
21-scheduled-restore-testing/
├── 21.1-monthly-workflow/
│   ├── choose-known-good-backup
│   ├── create-temporary-postgresql-target
│   ├── restore-backup
│   ├── execute-smoke-tests
│   └── clean-up-temporary-resources
│
├── 21.2-integrity-checks/
│   ├── expected-tables-exist
│   ├── representative-records-readable
│   ├── foreign-keys-consistent
│   └── latest-schema-compatible
│
└── 21.3-result/
    ├── fail-workflow-on-restore-failure
    └── preserve-success-timestamp
```

---

# 22-observability-and-error-handling/

```text
22-observability-and-error-handling/
├── 22.1-application-logging/
│   ├── upload-errors
│   ├── r2-errors
│   ├── database-errors
│   ├── ai-errors
│   ├── report-errors
│   └── authentication-security-events
│
├── 22.2-secret-redaction/
│   ├── passwords
│   ├── password-hashes
│   ├── session-secrets
│   ├── database-urls
│   ├── storage-credentials
│   ├── ai-api-keys
│   └── raw-sensitive-document-content
│
├── 22.3-user-facing-errors/
│   ├── actionable-upload-error
│   ├── actionable-processing-error
│   ├── retryable-error-state
│   └── generic-unexpected-error-page
│
└── 22.4-health-checks/
    ├── database-connectivity
    ├── r2-connectivity
    └── backup-health-derived-from-backup-metadata
```

---

# 23-testing/

```text
23-testing/
├── 23.1-unit-tests/
│   ├── validation
│   ├── totals
│   ├── vat-calculation-validation
│   ├── document-state-machine
│   ├── manual-correction-precedence
│   ├── duplicate-detection
│   └── report-aggregation
│
├── 23.2-integration-tests/
│   ├── database-repositories
│   ├── r2-adapter
│   ├── authentication
│   ├── upload-pipeline
│   ├── extraction-persistence
│   └── reporting
│
├── 23.3-end-to-end-tests/
│   ├── login
│   ├── upload-document
│   ├── wait-for-processing
│   ├── review-document
│   ├── correct-field
│   ├── categorize-expense
│   ├── search-document
│   ├── monthly-report
│   ├── export-report
│   └── logout
│
├── 23.4-security-tests/
│   ├── protected-pages
│   ├── protected-route-handlers
│   ├── signed-url-generation
│   ├── session-expiry
│   └── direct-object-access
│
├── 23.5-backup-tests/
│   ├── db-backup
│   ├── object-backup
│   ├── manifest-validation
│   └── restore
│
└── 23.6-responsive-tests/
    ├── desktop
    ├── tablet
    └── mobile
```

---

# 24-data-integrity/

```text
24-data-integrity/
├── 24.1-database-constraints/
│   ├── foreign-keys
│   ├── not-null-constraints
│   ├── valid-status-values
│   ├── percentage-ranges
│   └── monetary-value-rules
│
├── 24.2-transaction-boundaries/
│   ├── document-metadata-updates
│   ├── expense-updates
│   ├── audit-event-writing
│   └── report-record-generation
│
├── 24.3-storage-consistency/
│   ├── avoid-db-record-claiming-upload-succeeded-before-r2-success
│   ├── handle-r2-success-db-failure
│   └── recovery-for-partially-completed-ingestion
│
└── 24.4-periodic-integrity-check/
    ├── missing-r2-file
    ├── checksum-mismatch
    ├── orphaned-r2-file
    └── missing-b2-backup
```

---

# 25-performance/

```text
25-performance/
├── 25.1-database/
│   ├── indexes
│   ├── pagination
│   ├── avoid-unbounded-document-queries
│   └── aggregate-report-queries-efficiently
│
├── 25.2-ui/
│   ├── server-render-initial-lists
│   ├── avoid-loading-full-document-files-in-list
│   ├── lazy-load-previews
│   └── use-thumbnail-or-preview-assets
│
├── 25.3-storage/
│   ├── signed-url-expiration
│   ├── preview-generation
│   └── avoid-serving-backup-storage
│
└── 25.4-ai/
    ├── avoid-unnecessary-reprocessing
    ├── persist-extraction-results
    └── explicit-user-trigger-for-reprocessing
```

---

# 26-responsive-and-mobile-polish/

```text
26-responsive-and-mobile-polish/
├── 26.1-upload/
│   ├── mobile-camera-or-photo-picker
│   ├── large-touch-targets
│   └── upload-status-readable-on-small-screen
│
├── 26.2-documents/
│   ├── cards-on-small-screens
│   └── no-horizontal-table-dependency
│
├── 26.3-document-detail/
│   ├── stack-preview-and-form
│   ├── easy-preview-expansion
│   └── sticky-save-action-if-useful
│
├── 26.4-dashboard/
│   ├── compact-summary-cards
│   └── avoid-dense-charting
│
└── 26.5-navigation/
    ├── drawer
    └── preserve-upload-action-prominence
```

---

# 27-documentation/

```text
27-documentation/
├── 27.1-developer-readme/
│   ├── local-setup
│   ├── required-environment-variables
│   ├── database-migrations
│   ├── test-commands
│   └── deployment
│
├── 27.2-architecture/
│   ├── system-diagram
│   ├── domain-model
│   ├── storage-model
│   ├── authentication-model
│   └── backup-model
│
├── 27.3-operations/
│   ├── backup-process
│   ├── restore-process
│   ├── credential-rotation
│   ├── failed-ai-processing
│   └── failed-backup-response
│
└── 27.4-user-guide/
    ├── login
    ├── upload
    ├── review
    ├── search
    ├── reports
    └── archive
```

---

# 28-production-readiness/

```text
28-production-readiness/
├── 28.1-security-review/
│   ├── no-public-r2-bucket
│   ├── no-public-b2-bucket
│   ├── all-protected-routes-require-session
│   ├── no-secrets-in-client-bundle
│   ├── no-secrets-in-logs
│   ├── backup-credentials-separated-from-app
│   └── strong-password-configured
│
├── 28.2-data-review/
│   ├── migrations-committed
│   ├── production-schema-current
│   ├── db-constraints-enabled
│   ├── original-files-have-sha256
│   └── manual-edits-not-overwritten-by-ai
│
├── 28.3-backup-review/
│   ├── nightly-db-backup-successful
│   ├── nightly-object-backup-successful
│   ├── retention-active
│   ├── verification-active
│   └── restore-test-successful
│
├── 28.4-user-flow-review/
│   ├── login
│   ├── upload
│   ├── processing
│   ├── review
│   ├── manual-correction
│   ├── category
│   ├── search
│   ├── report
│   ├── export
│   └── logout
│
├── 28.5-mobile-review/
│   ├── login
│   ├── photo-upload
│   ├── upload-tray
│   ├── edit-document
│   └── monthly-report
│
└── 28.6-release/
    ├── production-environment-variables
    ├── deploy-production
    ├── smoke-test
    ├── upload-real-test-document
    ├── verify-r2-object
    ├── verify-neon-metadata
    ├── verify-ai-extraction
    ├── run-backup
    ├── verify-b2-copy
    └── mark-v1-released
```

---

# Cross-branch dependency map

The tree above captures most dependencies naturally, but these cross-branch dependencies are important.

```text
3-authentication-and-security/
↳ depends on:
   0-project-bootstrap/

4-application-shell/
↳ depends on:
   3-authentication-and-security/

5-primary-document-storage/
↳ depends on:
   1-cloud-foundation/
   2-domain-and-database-foundation/

6-document-upload-pipeline/
↳ depends on:
   2-domain-and-database-foundation/
   3-authentication-and-security/
   5-primary-document-storage/

7-document-processing-and-ai/
↳ depends on:
   2-domain-and-database-foundation/
   6-document-upload-pipeline/

8-background-processing/
↳ depends on:
   7-document-processing-and-ai/

9-document-management-ui/
↳ depends on:
   4-application-shell/
   6-document-upload-pipeline/

10-bookkeeping-workflow/
↳ depends on:
   2-domain-and-database-foundation/
   7-document-processing-and-ai/
   9-document-management-ui/

11-upload-tray/
↳ depends on:
   7-document-processing-and-ai/
   8-background-processing/
   10-bookkeeping-workflow/

12-dashboard/
↳ depends on:
   10-bookkeeping-workflow/
   11-upload-tray/

13-reporting/
↳ depends on:
   10-bookkeeping-workflow/
   5-primary-document-storage/

14-settings/
↳ depends on:
   4-application-shell/

15-audit-history/
↳ depends on:
   2-domain-and-database-foundation/
   10-bookkeeping-workflow/

16-backup-foundation/
↳ depends on:
   1-cloud-foundation/

17-database-backup/
↳ depends on:
   16-backup-foundation/
   2-domain-and-database-foundation/

18-r2-to-b2-backup/
↳ depends on:
   16-backup-foundation/
   5-primary-document-storage/

19-backup-observability/
↳ depends on:
   17-database-backup/
   18-r2-to-b2-backup/

20-disaster-recovery/
↳ depends on:
   17-database-backup/
   18-r2-to-b2-backup/

21-scheduled-restore-testing/
↳ depends on:
   20-disaster-recovery/

22-observability-and-error-handling/
↳ depends on:
   application features being instrumented

23-testing/
↳ grows continuously with every feature branch

24-data-integrity/
↳ depends on:
   2-domain-and-database-foundation/
   5-primary-document-storage/
   6-document-upload-pipeline/

25-performance/
↳ depends on:
   working feature implementation and realistic data access patterns

26-responsive-and-mobile-polish/
↳ depends on:
   4-application-shell/
   9-document-management-ui/
   11-upload-tray/
   12-dashboard/
   13-reporting/

27-documentation/
↳ grows continuously
↳ final operational documentation depends on:
   20-disaster-recovery/

28-production-readiness/
↳ depends on:
   all V1-critical branches
```

---

# Recommended execution waves

The following waves expose the useful parallelism in the task tree.

```text
wave-1/
├── project-bootstrap
└── repository-ci
```

```text
wave-2/
├── vercel
├── neon
├── r2
├── b2
└── environment-isolation
```

These infrastructure branches can largely proceed in parallel.

```text
wave-3/
├── database-and-domain-model
├── authentication
├── application-shell
├── r2-storage-adapter
└── backup-foundation
```

After basic cloud resources exist, these branches can proceed mostly independently.

```text
wave-4/
├── upload-pipeline
├── database-backup
├── r2-to-b2-backup
├── category-management-foundation
└── base-document-list-ui
```

```text
wave-5/
├── ai-extraction
├── background-processing
├── document-detail
├── search-and-filters
└── audit-events
```

```text
wave-6/
├── bookkeeping-workflow
├── upload-tray
├── backup-observability
└── disaster-recovery-tooling
```

```text
wave-7/
├── dashboard
├── monthly-reporting
├── exports
├── settings-system-status
└── scheduled-restore-testing
```

```text
wave-8/
├── responsive-polish
├── integrity-checking
├── performance
├── observability
├── security-review
└── end-to-end-testing
```

```text
wave-9/
└── production-readiness
    ├── real-upload
    ├── real-ai-processing
    ├── real-manual-correction
    ├── real-report
    ├── real-db-backup
    ├── real-r2-to-b2-backup
    └── real-restore-test
```

---

# Critical path

The shortest path to a usable end-to-end application is approximately:

```text
project-bootstrap
└── cloud-foundation
    └── database-foundation
        └── authentication
            └── application-shell
                └── r2-storage
                    └── upload-pipeline
                        └── ai-processing
                            └── background-processing
                                └── document-detail
                                    └── bookkeeping-workflow
                                        └── upload-tray
                                            └── reporting
```

Backup development runs substantially in parallel:

```text
cloud-foundation
└── backup-foundation
    ├── database-backup
    └── r2-to-b2-backup
        └── backup-observability
            └── disaster-recovery
                └── restore-testing
```

The two paths join before production release:

```text
product-path ───────┐
                    ├── production-readiness
recovery-path ──────┘
```

---

# V1 release gate

Do not call the application production-ready until all of these paths are green:

```text
v1-release/
├── security/
│   ├── login
│   ├── protected-pages
│   ├── protected-server-actions
│   ├── private-r2
│   └── separated-backup-credentials
│
├── core-product/
│   ├── upload
│   ├── ai-extraction
│   ├── manual-review
│   ├── correction
│   ├── categorization
│   ├── search
│   ├── monthly-report
│   └── export
│
├── durability/
│   ├── immutable-r2-original
│   ├── sha256
│   ├── neon-metadata
│   ├── b2-database-backup
│   ├── b2-document-backup
│   ├── manifest-verification
│   └── successful-restore-test
│
├── usability/
│   ├── desktop
│   ├── mobile
│   ├── dashboard
│   ├── upload-tray
│   ├── documents
│   └── reports
│
└── operations/
    ├── ci-green
    ├── backup-workflow-green
    ├── restore-documented
    ├── errors-visible
    └── secrets-protected
```
