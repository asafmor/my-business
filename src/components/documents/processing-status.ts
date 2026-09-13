import type { DocumentStatus } from "../../domain/documents/types";

export function isTerminalDocumentStatus(status: DocumentStatus): boolean {
  return status === "READY" || status === "NEEDS_REVIEW" || status === "FAILED";
}

export function shouldRefreshProcessingStatus(
  statuses: readonly DocumentStatus[],
): boolean {
  return statuses.some((status) => !isTerminalDocumentStatus(status));
}
