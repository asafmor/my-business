import type { DocumentStatus } from "./types";

/**
 * The Inbox is workflow-oriented, not archival (SPEC.md #15): every
 * non-archived document falls into exactly one of these sections. ARCHIVED
 * documents never appear in the Inbox.
 */
export const inboxSections = [
  "needsReview",
  "processing",
  "failed",
  "recentlyCompleted",
] as const;
export type InboxSection = (typeof inboxSections)[number];

const sectionStatuses: Record<InboxSection, readonly DocumentStatus[]> = {
  failed: ["FAILED"],
  needsReview: ["NEEDS_REVIEW"],
  // UPLOADED documents are also "processing" from the user's point of view:
  // they are queued for background processing and not yet actionable.
  processing: ["UPLOADED", "PROCESSING"],
  recentlyCompleted: ["READY"],
};

export function statusesForSection(
  section: InboxSection,
): readonly DocumentStatus[] {
  return sectionStatuses[section];
}
