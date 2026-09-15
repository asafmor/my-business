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
    expect(matchesFilter(item({ status: "uploading" }), "active")).toBe(true);
    expect(matchesFilter(item({ status: "needs-review" }), "review")).toBe(
      true,
    );
    expect(matchesFilter(item({ status: "processing-failed" }), "failed")).toBe(
      true,
    );
    expect(matchesFilter(item({ status: "complete" }), "active")).toBe(false);
    expect(matchesFilter(item({ status: "complete" }), "all")).toBe(true);
  });
});

describe("sortItems", () => {
  it("orders in-flight, needs-review, failed, processing, then completed", () => {
    const items = [
      item({ id: "complete", status: "complete" }),
      item({ id: "processing", status: "processing" }),
      item({ id: "failed", status: "failed" }),
      item({ id: "needs-review", status: "needs-review" }),
      item({ id: "uploading", status: "uploading" }),
    ];

    expect(sortItems(items).map((entry) => entry.id)).toEqual([
      "uploading",
      "needs-review",
      "failed",
      "processing",
      "complete",
    ]);
  });
});

describe("mergeItems", () => {
  it("drops a server row whose documentId matches a session item", () => {
    const sessionItems = [
      item({ documentId: "doc-1", id: "session-1", status: "processing" }),
    ];
    const serverItems = [
      item({
        documentId: "doc-1",
        id: "doc-1",
        kind: "document",
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

    expect(merged.map((entry) => entry.id)).toEqual(["doc-2", "session-1"]);
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
