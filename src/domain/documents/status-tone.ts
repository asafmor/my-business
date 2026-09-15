const statusTones: Record<string, string> = {
  ARCHIVED: "neutral",
  FAILED: "error",
  NEEDS_REVIEW: "warning",
  PROCESSING: "neutral",
  READY: "success",
  UPLOADED: "neutral",
};

/** The badge tone a document status wears, everywhere it is shown. */
export function statusTone(status: string): string {
  return statusTones[status] ?? "neutral";
}

/**
 * The row tint a status earns. Only a status that asks something of the
 * reader gets one; everything else stays plain.
 */
export function statusRowState(status: string): string | undefined {
  return {
    FAILED: "is-failed",
    NEEDS_REVIEW: "is-attention",
    PROCESSING: "is-processing",
  }[status];
}
