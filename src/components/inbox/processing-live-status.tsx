"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { DocumentStatus } from "../../domain/documents/types";
import { isTerminalDocumentStatus } from "../documents/processing-status";

type ProcessingStatusResult = { id: string; status: DocumentStatus };

/**
 * Invisible poller for the Inbox's "Processing" section: reuses the same
 * status API and polling shape as upload-form.tsx, but instead of tracking
 * per-card client state it just asks the server component to re-render
 * (router.refresh — an RSC refetch, not a full page reload) once any
 * document leaves the processing state.
 */
export function ProcessingLiveStatus({
  documentIds,
}: {
  documentIds: string[];
}) {
  const router = useRouter();

  useEffect(() => {
    if (documentIds.length === 0) return;

    let cancelled = false;
    async function poll(): Promise<void> {
      try {
        const response = await fetch("/api/documents/processing/status", {
          body: JSON.stringify({ documentIds }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        if (!response.ok || cancelled) return;
        const { documents } = (await response.json()) as {
          documents: ProcessingStatusResult[];
        };
        if (
          documents.some((document) =>
            isTerminalDocumentStatus(document.status),
          )
        ) {
          router.refresh();
        }
      } catch {
        // A missed poll does not change the durable processing task.
      }
    }

    const interval = window.setInterval(() => void poll(), 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [documentIds, router]);

  return null;
}
