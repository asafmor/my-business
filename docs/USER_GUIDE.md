# User guide

A short walkthrough for the app's single owner-user. Section headings match
the routes; button/link text below is copied verbatim from the app.

## Login

Open the app. If you're not signed in you land on the login page ("My
Business — Sign in to continue."). Enter your **Password** and select
**Sign in**. There's no username — the app has exactly one account. Five
failed attempts within 10 minutes locks login out for 15 minutes.

## Upload

Go to **Upload documents** (`/upload`). Either drag files onto the drop
zone ("Drag files here, or choose them from your device.") or select
**Choose files** to pick from your device's file browser. Accepted types
are JPEG, PNG, WebP, or PDF, up to 10 MB each.

On a phone, select **Take photo** instead to open the camera directly and
photograph a receipt on the spot, rather than picking an existing photo.

A floating **upload tray** appears as soon as you add a file, and follows
you around the app — it survives navigating between pages and is only
cleared by a hard refresh. Each upload shows live progress and a status
(Uploaded, Needs review, Possible duplicate, Upload failed, etc). A likely
duplicate is flagged before it's stored twice.

Reopen the tray any time with the tray icon in the header (it shows a live
count) or the collapsed summary bar above the mobile tab bar. Filter its
contents by _Active_, _Needs review_, or _Failed_.

## Review

Documents that need attention appear in the upload tray, which seeds itself
from the server so nothing already on file is missing, and merges in
whatever you're uploading this session.

- For a document under **Needs review**, check the flagged reasons shown
  under it and select **Open** to go to the full document detail page and
  correct fields, then select **Approve** once it's correct.
- For a document under **Failed**, select **Retry processing** to try AI
  extraction again, or open it and correct fields by hand.

The document detail page (`/documents/{id}`) opens with the supplier, status
and total at the top, the original beside the details on desktop, and the
document's activity history underneath. A field the AI could not read with
confidence is flagged in cream with a sentence saying why; a field you have
corrected carries a small pencil beside its label. On a phone the details are a list you
read first — tap any row or **Edit** to open the form, then **Save** from
the bar at the bottom.

The actions at the top:

- **Mark reviewed** — accept the document as reviewed. This is the primary
  button while the document needs review.
- **Read again** — re-run AI extraction (same as the tray's Retry
  processing). This is the primary button after a failed read.
- **Archive** — move the document out of the active list (see "Archive"
  below), after a confirmation. On an already-archived document the only
  action is **Restore**.

Any field you edit by hand is preserved — AI never overwrites your
correction on a later read. The **Technical details** drawer at the foot
holds the extraction runs, the raw AI output and the file records, for the
day something reads wrong.

## Search

Go to **Documents** (`/documents`) to browse and filter everything. The
**Search** field does a free-text search; you can also narrow by Supplier,
Type, Category, Status, Month, a From/To date range, and a Min/Max amount,
and change the sort order. Results are paginated.

## Reports

Go to **Reports** (`/reports`). It defaults to the current month; use the
`←`/`→` month links to move between months. It shows a summary (document
count, gross/net/VAT totals, count needing review), breakdowns by category
and by supplier, and a list of documents needing attention for that month
(linking to the document detail page).

Under **Export**:

- **Export CSV** downloads a CSV of the month directly.
- **Generate PDF report** creates a PDF report artifact for the month,
  which then appears under **Generated PDF reports** with a **Download**
  link.

## Archive

From a document's detail page, select **Archive**. This is a status change
(`ARCHIVED`), not a permanent delete — the underlying file and history stay
intact (original documents are never deleted by normal application use —
see docs/SPEC.md §2.1). Archiving removes it from the upload tray and
redirects you to Documents; to find it again, go to **Documents** and set
the **Status** filter to **Archived**.

Archiving is reversible. On an archived document, the detail page offers
**Restore** in place of **Archive**, and under the **Archived** status filter
the Documents list offers **Restore** on a row and **Restore selected** for a
whole selection. A restored document returns to the status it held before it
was archived; documents archived before that status was recorded come back as
`NEEDS_REVIEW`.
