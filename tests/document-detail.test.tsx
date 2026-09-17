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
    expect(formatDateLong("2024-04-05")).toBe("5 באפריל 2024");
    expect(formatDateLong(null)).toBe("—");
    expect(formatDateLong("not a date")).toBe("—");
  });

  it("writes a timestamp with a 24-hour clock in the given zone", () => {
    expect(formatDateTimeLong(new Date("2024-04-05T14:32:00Z"), "UTC")).toBe(
      "5 באפריל 2024, 14:32",
    );
    expect(formatDateTimeLong(new Date("2024-04-05T00:05:00Z"), "UTC")).toBe(
      "5 באפריל 2024, 00:05",
    );
  });

  it("defaults a server render to Israel's clock", () => {
    expect(
      formatDateTimeLong(new Date("2024-04-05T21:32:00Z"), "Asia/Jerusalem"),
    ).toBe("6 באפריל 2024, 00:32");
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
    expect(entry.title).toBe("הועלה");
    expect(entry.detail).toBe("receipt.webp · 27.1 KB");
    expect(entry.source).toBe("You");
    expect(entry.sourceLabel).toBe("אתם");
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
    expect(entry.title).toBe("נקרא על ידי AI");
    expect(entry.tone).toBe("warning");
    expect(entry.source).toBe("AI");
    expect(entry.detail).toBe(
      'לא ניתן היה לקבוע את הסכום לפני מע"מ. זוהתה חריגה אפשרית במסמך.',
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
    expect(entry.title).toBe("נקרא מחדש על ידי AI");
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
    expect(entry.title).toBe("הקריאה נכשלה");
    expect(entry.tone).toBe("danger");
    expect(entry.kind).toBe("failure");
    expect(entry.detail).toBe("החילוץ האוטומטי נכשל.");
    expect(entry.source).toBe("System");
    expect(entry.sourceLabel).toBe("המערכת");
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
    expect(entry.title).toBe("תאריך השתנה");
    expect(entry.before).toBe("15 בינואר 2024");
    expect(entry.after).toBe("1 בפברואר 2024");
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
    expect(entry.title).toBe("קטגוריה השתנה");
    expect(entry.before).toBe("—");
    expect(entry.after).toBe("Meals");
    expect(entry.kind).toBe("category");
  });

  it("keeps the archive round trip to a verb and a status", () => {
    expect(
      describeAuditEvent(
        event({ action: "ARCHIVE", newValue: "ARCHIVED", oldValue: "READY" }),
      ),
    ).toMatchObject({ after: null, before: null, title: "הועבר לארכיון" });
    expect(
      describeAuditEvent(
        event({ action: "UNARCHIVE", newValue: "READY", oldValue: "ARCHIVED" }),
      ),
    ).toMatchObject({
      detail: 'חזר למצב "מוכן".',
      title: "שוחזר מהארכיון",
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
    ).toEqual({ ok: true, text: 'הסכום לפני מע"מ והמע"מ מסתכמים לסה"כ.' });
    expect(
      reconcileAmounts(
        { subtotal: "237.29", total: "281.00", vat: "42.71" },
        "ILS",
      ),
    ).toEqual({
      ok: false,
      text: 'הסכום לפני מע"מ והמע"מ מסתכמים ל־₪ 280.00, לא לסה"כ.',
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
      flagged={{ total: "לא ניתן היה לקבוע את הסכום." }}
      values={values}
    />,
  );

  it("starts in read mode with the values written for a person", () => {
    expect(html).toContain('data-mode="read"');
    expect(html).toContain("$ 45.00");
    expect(html).toContain("5 באפריל 2024");
    expect(html).toContain("Meals");
    expect(html).toContain("קבלה");
    expect(html).toContain("100%");
  });

  it("tags corrected fields and flags fields that need a look", () => {
    expect(html).toContain("נערך");
    expect(html).toContain("fact-row--flagged");
    expect(html).toContain('data-flagged=""');
    expect(html).toContain("שדה אחד דורש בדיקה.");
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
    expect(html).toMatch(/button--primary[^>]*>[^<]*<svg[^]*?סימון כנבדק/);
    expect(html).toContain("קריאה מחדש");
    expect(html).toContain("העברה לארכיון");
  });

  it("makes Read again the primary verb after a failure", () => {
    expect(render("FAILED")).toMatch(
      /button--primary[^>]*>[^<]*<svg[^]*?קריאה מחדש/,
    );
  });

  it("offers only Restore for an archived document", () => {
    const html = render("ARCHIVED");
    expect(html).toContain("שחזור");
    expect(html).not.toContain("סימון כנבדק");
    expect(html).not.toContain("record-actions__archive");
  });

  it("hides Mark reviewed once a ready document has been reviewed", () => {
    expect(render("READY", true)).not.toContain("סימון כנבדק");
    expect(render("READY", false)).toContain("סימון כנבדק");
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
    expect(html).toContain("סה&quot;כ השתנה");
    expect(html).toContain("156.20");
    expect(html).toContain("158.20");
    expect(html).toContain("activity__source--you");
    expect(html).toContain('dateTime="2026-09-15T21:00:42.000Z"');
    /* The server writes Israel's clock: 21:00 UTC is past midnight there. */
    expect(html).toContain("16 בספטמבר 2026, 00:00");
  });

  it("says so when nothing has happened", () => {
    expect(
      renderToStaticMarkup(
        <DocumentActivity categoryNameById={{}} events={[]} />,
      ),
    ).toContain("עדיין לא קרה דבר.");
  });
});
