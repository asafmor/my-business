import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/* The components import their server actions; the module graph behind them
   is not under test and must not drag "server-only" into a client render. */
vi.mock("server-only", () => ({}));
vi.mock("../src/app/(protected)/documents/[id]/actions", () => ({
  archiveDocumentAction: vi.fn(),
  markReviewedAction: vi.fn(),
  reprocessDocumentAction: vi.fn(),
  unarchiveDocumentAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { DocumentActions } from "../src/components/documents/document-actions";
import { DocumentActivity } from "../src/components/documents/document-activity";
import {
  DocumentDetails,
  reconcileAmounts,
  vatRate,
  type DocumentValues,
} from "../src/components/documents/document-details";
import { reviewReasonField } from "../src/domain/documents/attention-reasons";
import { describeAuditEvent } from "../src/domain/documents/audit-change";
import type { AuditEvent, DocumentStatus } from "../src/domain/documents/types";
import { formatDateLong, formatDateTimeLong } from "../src/lib/format";

function event(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    action: "REVIEW",
    createdAt: new Date("2026-09-15T21:00:42Z"),
    entityId: "doc-1",
    entityType: "DOCUMENT",
    field: null,
    id: "evt-1",
    newValue: null,
    oldValue: null,
    source: "USER",
    ...overrides,
  };
}

describe("formatDateLong / formatDateTimeLong", () => {
  it("writes a calendar date the way a person does", () => {
    expect(formatDateLong("2024-04-05")).toBe("5 Apr 2024");
    expect(formatDateLong(null)).toBe("—");
    expect(formatDateLong("not a date")).toBe("—");
  });

  it("writes a timestamp with a 24-hour clock in the given zone", () => {
    expect(formatDateTimeLong(new Date("2024-04-05T14:32:00Z"), "UTC")).toBe(
      "5 Apr 2024, 14:32",
    );
    expect(formatDateTimeLong(new Date("2024-04-05T00:05:00Z"), "UTC")).toBe(
      "5 Apr 2024, 00:05",
    );
  });
});

describe("reviewReasonField", () => {
  it("points field-specific reasons at their field", () => {
    expect(reviewReasonField("MISSING_TOTAL")).toBe("total");
    expect(reviewReasonField("SUSPICIOUS_VAT")).toBe("vat");
    expect(reviewReasonField("INVALID_DOCUMENT_TYPE")).toBe("documentType");
  });

  it("leaves document-wide reasons to the banner", () => {
    expect(reviewReasonField("LOW_CONFIDENCE")).toBeNull();
    expect(reviewReasonField("ANOMALY_DETECTED")).toBeNull();
  });
});

describe("describeAuditEvent", () => {
  it("describes an upload by its file", () => {
    const entry = describeAuditEvent(
      event({
        action: "UPLOAD",
        newValue: {
          fileName: "receipt.webp",
          mimeType: "image/webp",
          sha256: "a".repeat(64),
          sizeBytes: 27146,
        },
      }),
    );
    expect(entry.title).toBe("Uploaded");
    expect(entry.detail).toBe("receipt.webp · 27.1 KB");
    expect(entry.source).toBe("You");
    expect(entry.kind).toBe("upload");
  });

  it("describes an AI read that needs review with the reasons as sentences", () => {
    const entry = describeAuditEvent(
      event({
        action: "EXTRACTION",
        newValue: {
          extractionId: "x",
          reviewReasons: ["MISSING_SUBTOTAL", "ANOMALY_DETECTED"],
          schemaVersion: "2026-09-13.1",
          status: "NEEDS_REVIEW",
        },
        source: "AI",
      }),
    );
    expect(entry.title).toBe("Read by AI");
    expect(entry.tone).toBe("warning");
    expect(entry.source).toBe("AI");
    expect(entry.detail).toBe(
      "Subtotal could not be determined. Possible anomaly detected in this document.",
    );
  });

  it("describes a clean re-read as a success", () => {
    const entry = describeAuditEvent(
      event({
        action: "REPROCESSING",
        newValue: { reviewReasons: [], status: "READY" },
        source: "AI",
      }),
    );
    expect(entry.title).toBe("Read again by AI");
    expect(entry.tone).toBe("success");
  });

  it("describes a failed read in danger tone with the failure sentence", () => {
    const entry = describeAuditEvent(
      event({
        action: "EXTRACTION",
        newValue: { failure: "ANALYZER_FAILURE" },
        source: "SYSTEM",
      }),
    );
    expect(entry.title).toBe("Reading failed");
    expect(entry.tone).toBe("danger");
    expect(entry.kind).toBe("failure");
    expect(entry.detail).toBe("Automatic extraction failed.");
    expect(entry.source).toBe("System");
  });

  it("formats a field change as a labelled before and after", () => {
    const entry = describeAuditEvent(
      event({
        action: "MANUAL_EDIT",
        entityType: "EXPENSE",
        field: "transactionDate",
        newValue: "2024-02-01",
        oldValue: "2024-01-15",
      }),
    );
    expect(entry.title).toBe("Date changed");
    expect(entry.before).toBe("15 Jan 2024");
    expect(entry.after).toBe("1 Feb 2024");
    expect(entry.kind).toBe("edit");
  });

  it("resolves a category change to names", () => {
    const entry = describeAuditEvent(
      event({
        action: "CATEGORY_CHANGE",
        entityType: "EXPENSE",
        field: "category",
        newValue: "cat-2",
        oldValue: null,
      }),
      { "cat-2": "Meals" },
    );
    expect(entry.title).toBe("Category changed");
    expect(entry.before).toBe("—");
    expect(entry.after).toBe("Meals");
    expect(entry.kind).toBe("category");
  });

  it("keeps the archive round trip to a verb and a status", () => {
    expect(
      describeAuditEvent(
        event({ action: "ARCHIVE", newValue: "ARCHIVED", oldValue: "READY" }),
      ),
    ).toMatchObject({ after: null, before: null, title: "Archived" });
    expect(
      describeAuditEvent(
        event({ action: "UNARCHIVE", newValue: "READY", oldValue: "ARCHIVED" }),
      ),
    ).toMatchObject({
      detail: "Back to ready.",
      title: "Restored from the archive",
      tone: "success",
    });
  });
});

describe("amount helpers", () => {
  it("says when subtotal and VAT add up to the total, and when they do not", () => {
    expect(
      reconcileAmounts(
        { subtotal: "237.29", total: "280.00", vat: "42.71" },
        "ILS",
      ),
    ).toEqual({ ok: true, text: "Subtotal and VAT add up to the total." });
    expect(
      reconcileAmounts(
        { subtotal: "237.29", total: "281.00", vat: "42.71" },
        "ILS",
      ),
    ).toEqual({
      ok: false,
      text: "Subtotal and VAT add up to ₪ 280.00, not the total.",
    });
  });

  it("stays quiet while an amount is missing", () => {
    expect(
      reconcileAmounts({ subtotal: "", total: "280.00", vat: "42.71" }, null),
    ).toBeNull();
  });

  it("derives the VAT rate from the subtotal", () => {
    expect(vatRate("18.00", "100.00")).toBe("18%");
    expect(vatRate("42.71", "237.29")).toBe("18.0%");
    expect(vatRate("4.50", "")).toBeNull();
    expect(vatRate("4.50", "0")).toBeNull();
  });
});

const values: DocumentValues = {
  businessUsePercentage: "100",
  categoryId: "cat-1",
  currency: "USD",
  documentNumber: null,
  documentType: "RECEIPT",
  notes: null,
  paymentMethod: null,
  subtotal: "40.50",
  supplierName: "Joe's Diner",
  total: "45.00",
  transactionDate: "2024-04-05",
  vat: "4.50",
};

describe("DocumentDetails", () => {
  const html = renderToStaticMarkup(
    <DocumentDetails
      action={vi.fn()}
      categories={[{ id: "cat-1", name: "Meals" }]}
      edited={["subtotal"]}
      flagged={{ total: "Amount could not be determined." }}
      values={values}
    />,
  );

  it("starts in read mode with the values written for a person", () => {
    expect(html).toContain('data-mode="read"');
    expect(html).toContain("$ 45.00");
    expect(html).toContain("5 Apr 2024");
    expect(html).toContain("Meals");
    expect(html).toContain("100%");
  });

  it("tags corrected fields and flags fields that need a look", () => {
    expect(html).toContain("Edited");
    expect(html).toContain("fact-row--flagged");
    expect(html).toContain('data-flagged=""');
    expect(html).toContain("1 field needs a look.");
  });

  it("keeps Save disabled until something changes", () => {
    expect(html).toMatch(
      /<button class="button button--primary" disabled=""[^>]*type="submit"/,
    );
  });
});

describe("DocumentActions", () => {
  function render(status: DocumentStatus, reviewed = false) {
    return renderToStaticMarkup(
      <DocumentActions
        documentId="doc-1"
        name="Joe's Diner"
        reviewed={reviewed}
        status={status}
      />,
    );
  }

  it("makes Mark reviewed the primary verb for a document needing review", () => {
    const html = render("NEEDS_REVIEW");
    expect(html).toMatch(/button--primary[^>]*>[^<]*<svg[^]*?Mark reviewed/);
    expect(html).toContain("Read again");
    expect(html).toContain("Archive");
  });

  it("makes Read again the primary verb after a failure", () => {
    expect(render("FAILED")).toMatch(
      /button--primary[^>]*>[^<]*<svg[^]*?Read again/,
    );
  });

  it("offers only Restore for an archived document", () => {
    const html = render("ARCHIVED");
    expect(html).toContain("Restore");
    expect(html).not.toContain("Mark reviewed");
    expect(html).not.toContain("record-actions__archive");
  });

  it("hides Mark reviewed once a ready document has been reviewed", () => {
    expect(render("READY", true)).not.toContain("Mark reviewed");
    expect(render("READY", false)).toContain("Mark reviewed");
  });
});

describe("DocumentActivity", () => {
  it("renders a timeline with the change and the source", () => {
    const html = renderToStaticMarkup(
      <DocumentActivity
        categoryNameById={{}}
        events={[
          event({
            action: "MANUAL_EDIT",
            entityType: "EXPENSE",
            field: "total",
            newValue: "158.20",
            oldValue: "156.20",
          }),
        ]}
      />,
    );
    expect(html).toContain("Total changed");
    expect(html).toContain("156.20");
    expect(html).toContain("158.20");
    expect(html).toContain("activity__source--you");
    expect(html).toContain('dateTime="2026-09-15T21:00:42.000Z"');
    expect(html).toContain("15 Sep 2026, 21:00");
  });

  it("says so when nothing has happened", () => {
    expect(
      renderToStaticMarkup(
        <DocumentActivity categoryNameById={{}} events={[]} />,
      ),
    ).toContain("Nothing has happened yet.");
  });
});
