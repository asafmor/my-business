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

Each upload shows live progress and a status (Uploaded, Needs review,
Possible duplicate, Upload failed, etc). A likely duplicate is flagged
before it's stored twice.

## Review

Documents that need attention appear on the **Inbox** (`/inbox`) page in
one of four sections: _Needs review_, _Processing_, _Failed_, _Recently
completed_.

- For a document under **Needs review**, check the flagged reasons shown
  under it, correct any fields inline or open it (**Open** link) for the
  full document detail page, then select **Approve** once it's correct.
- For a document under **Failed**, select **Retry processing** to try AI
  extraction again, or open it and correct fields by hand.

On the document detail page (`/documents/{id}`), edit any field in the form,
then:

- **Mark reviewed** — accept the document as reviewed.
- **Reprocess** — re-run AI extraction (same as Inbox's Retry processing).
- **Archive** — move the document out of the active list (see "Archive"
  below).

Any field you edit by hand is preserved — AI never overwrites your
correction on a later reprocess.

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
(linking back to Inbox).

Under **Export**:

- **Export CSV** downloads a CSV of the month directly.
- **Generate PDF report** creates a PDF report artifact for the month,
  which then appears under **Generated PDF reports** with a **Download**
  link.

## Archive

From a document's detail page, select **Archive**. This is a status change
(`ARCHIVED`), not a permanent delete — the underlying file and history stay
intact (original documents are never deleted by normal application use —
see docs/SPEC.md §2.1). Archiving removes it from Inbox and redirects you
to Documents; to find it again, go to **Documents** and set the **Status**
filter to **Archived**. There is currently no in-app "unarchive" action.
