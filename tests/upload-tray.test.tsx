import { describe, expect, it } from "vitest";

import type { InboxBacklogResponse } from "../src/app/api/documents/inbox/route";
import {
  backlogToTrayItems,
  matchesFilter,
  mergeItems,
  sortItems,
  viewAfterOpen,
  viewAfterToggleOpen,
  type TrayItem,
} from "../src/components/uploads/upload-tray-provider";

function item(overrides: Partial<TrayItem>): TrayItem {
  return {
    id: "1",
    kind: "upload",
    name: "file.pdf",
    status: "queued",
    ...overrides,
  };
}

describe("matchesFilter", () => {
  it("groups statuses into the four tray filters", () => {
    expect(matchesFilter(item({ status: "uploading" }), "processing")).toBe(
      true,
    );
    expect(matchesFilter(item({ status: "needs-review" }), "review")).toBe(
      true,
    );
    expect(matchesFilter(item({ status: "processing-failed" }), "failed")).toBe(
      true,
    );
    expect(matchesFilter(item({ status: "complete" }), "processing")).toBe(
      false,
    );
    expect(matchesFilter(item({ status: "complete" }), "all")).toBe(true);
  });
});

describe("sortItems", () => {
  it("orders processing, then completed, then needs-review, then failed", () => {
    const items = [
      item({ id: "complete", status: "complete" }),
      item({ id: "failed", status: "failed" }),
      item({ id: "needs-review", status: "needs-review" }),
      item({ id: "processing", status: "processing" }),
      item({ id: "uploading", status: "uploading" }),
    ];

    expect(sortItems(items).map((entry) => entry.id)).toEqual([
      "processing",
      "uploading",
      "complete",
      "needs-review",
      "failed",
    ]);
  });
});

describe("mergeItems", () => {
  it("enriches a session item with the matching server row's meta instead of listing both", () => {
    const sessionItems = [
      item({ documentId: "doc-1", id: "session-1", status: "processing" }),
    ];
    const serverItems = [
      item({
        documentId: "doc-1",
        id: "doc-1",
        kind: "document",
        meta: "12 Jan · $42.00",
        status: "processing",
      }),
      item({
        documentId: "doc-2",
        id: "doc-2",
        kind: "document",
        status: "needs-review",
      }),
    ];

    const merged = mergeItems(sessionItems, serverItems);

    expect(merged.map((entry) => entry.id)).toEqual(["session-1", "doc-2"]);
    expect(merged.find((entry) => entry.id === "session-1")?.meta).toBe(
      "12 Jan · $42.00",
    );
  });

  it("drops a completed server row that isn't part of this session", () => {
    const serverItems = [
      item({
        documentId: "doc-3",
        id: "doc-3",
        kind: "document",
        status: "complete",
      }),
    ];

    expect(mergeItems([], serverItems)).toEqual([]);
  });

  it("keeps a session item that completed this session, enriched from the backlog", () => {
    const sessionItems = [
      item({ documentId: "doc-4", id: "session-4", status: "complete" }),
    ];
    const serverItems = [
      item({
        documentId: "doc-4",
        id: "doc-4",
        kind: "document",
        meta: "1 Feb · $10.00",
        status: "complete",
      }),
    ];

    const merged = mergeItems(sessionItems, serverItems);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "session-4",
      meta: "1 Feb · $10.00",
    });
  });
});

describe("backlogToTrayItems", () => {
  it("maps each backlog section to its tray status", () => {
    const backlog: InboxBacklogResponse = {
      failed: [
        {
          categoryName: null,
          currency: null,
          id: "f1",
          reasons: ["Automatic extraction failed."],
          status: "FAILED",
          supplierName: "Acme",
          total: null,
          transactionDate: null,
        },
      ],
      needsReview: [],
      processing: [],
      recentlyCompleted: [],
    };

    const items = backlogToTrayItems(backlog);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      documentId: "f1",
      kind: "document",
      name: "Acme",
      status: "processing-failed",
    });
  });
});

describe("view transitions", () => {
  it("restores the last open form factor when opening from dismissed", () => {
    expect(viewAfterOpen("minimized")).toBe("minimized");
    expect(viewAfterOpen("expanded")).toBe("expanded");
  });

  it("toggles between dismissed and the last open view", () => {
    expect(viewAfterToggleOpen("dismissed", "minimized")).toBe("minimized");
    expect(viewAfterToggleOpen("expanded", "minimized")).toBe("dismissed");
    expect(viewAfterToggleOpen("minimized", "expanded")).toBe("dismissed");
  });
});
