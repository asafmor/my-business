import { describe, expect, it } from "vitest";

import {
  inboxSections,
  statusesForSection,
} from "../src/domain/documents/inbox";
import { documentStatuses } from "../src/domain/documents/types";

describe("statusesForSection", () => {
  it("covers every non-archived document status exactly once", () => {
    const covered = inboxSections.flatMap((section) =>
      statusesForSection(section),
    );
    const nonArchived = documentStatuses.filter(
      (status) => status !== "ARCHIVED",
    );

    expect(covered.sort()).toEqual([...nonArchived].sort());
    expect(new Set(covered).size).toBe(covered.length);
  });

  it("never places ARCHIVED documents in any section", () => {
    for (const section of inboxSections) {
      expect(statusesForSection(section)).not.toContain("ARCHIVED");
    }
  });

  it("groups UPLOADED and PROCESSING together as 'processing'", () => {
    expect(statusesForSection("processing")).toEqual([
      "UPLOADED",
      "PROCESSING",
    ]);
  });

  it("maps the remaining sections to their single matching status", () => {
    expect(statusesForSection("needsReview")).toEqual(["NEEDS_REVIEW"]);
    expect(statusesForSection("failed")).toEqual(["FAILED"]);
    expect(statusesForSection("recentlyCompleted")).toEqual(["READY"]);
  });
});
