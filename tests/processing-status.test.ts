import { describe, expect, it } from "vitest";

import {
  isTerminalDocumentStatus,
  shouldRefreshProcessingStatus,
} from "../src/components/documents/processing-status";

describe("processing status refresh", () => {
  it("refreshes only while at least one document is nonterminal", () => {
    expect(shouldRefreshProcessingStatus(["UPLOADED", "PROCESSING"])).toBe(
      true,
    );
    expect(
      shouldRefreshProcessingStatus(["READY", "NEEDS_REVIEW", "FAILED"]),
    ).toBe(false);
  });

  it.each(["READY", "NEEDS_REVIEW", "FAILED"] as const)(
    "treats %s as terminal",
    (status) => {
      expect(isTerminalDocumentStatus(status)).toBe(true);
    },
  );
});
