"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { DocumentStatus } from "../../domain/documents/types";
import { isTerminalDocumentStatus } from "./processing-status";

const pollIntervalMs = 3000;

/**
 * While a document is being read, asks the status endpoint every few seconds
 * (which also nudges due processing along) and reloads the page's data the
 * moment the status moves on. Renders nothing.
 */
export function ProcessingWatcher({
  documentId,
  status,
}: {
  documentId: string;
  status: DocumentStatus;
}) {
  const router = useRouter();

  useEffect(() => {
    if (isTerminalDocumentStatus(status) || status === "ARCHIVED") return;
    let cancelled = false;

    async function check() {
      try {
        const response = await fetch("/api/documents/processing/status", {
          body: JSON.stringify({ documentIds: [documentId] }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        if (!response.ok || cancelled) return;
        const { documents } = (await response.json()) as {
          documents: { id: string; status: DocumentStatus }[];
        };
        if (documents[0] && documents[0].status !== status) router.refresh();
      } catch {
        // A dropped poll is not an error; the next tick tries again.
      }
    }

    const timer = setInterval(check, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [documentId, router, status]);

  return null;
}
