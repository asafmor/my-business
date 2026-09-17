"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  InboxBacklogResponse,
  InboxBacklogRow,
} from "../../app/api/documents/inbox/route";
import type { SharedUploadResult } from "../../domain/documents/shared-upload";
import type { DocumentStatus } from "../../domain/documents/types";
import { formatDate, formatMoney } from "../../lib/format";

export type TrayStatus =
  | "complete"
  | "duplicate"
  | "failed"
  | "needs-review"
  | "processing"
  | "processing-failed"
  | "queued"
  | "rejected"
  | "uploading";

export type TrayView = "dismissed" | "expanded" | "minimized";
export type TrayFilter = "all" | "failed" | "processing" | "review";

// A session upload the browser owns, or a server row it does not.
export type TrayItem = {
  documentId?: string;
  id: string;
  kind: "document" | "upload";
  message?: string;
  meta?: string;
  name: string;
  progress?: number;
  reasons?: string[];
  status: TrayStatus;
};

const processingStatuses: readonly TrayStatus[] = [
  "queued",
  "uploading",
  "processing",
];
const failedStatuses: readonly TrayStatus[] = [
  "duplicate",
  "failed",
  "processing-failed",
  "rejected",
];

export function matchesFilter(item: TrayItem, filter: TrayFilter): boolean {
  switch (filter) {
    case "processing":
      return processingStatuses.includes(item.status);
    case "review":
      return item.status === "needs-review";
    case "failed":
      return failedStatuses.includes(item.status);
    case "all":
      return true;
  }
}

// Processing first (queued/uploading/processing are all "in flight" from the
// user's point of view), then completed, then needs-review, then failed.
const statusOrder: Record<TrayStatus, number> = {
  queued: 0,
  uploading: 0,
  processing: 0,
  complete: 1,
  "needs-review": 2,
  duplicate: 3,
  failed: 3,
  "processing-failed": 3,
  rejected: 3,
};

// Dismissing and then starting an upload restores the form factor the user
// last chose (expanded vs. minimized), rather than always snapping open.
export function viewAfterOpen(
  lastOpenView: "expanded" | "minimized",
): TrayView {
  return lastOpenView;
}

export function viewAfterToggleOpen(
  view: TrayView,
  lastOpenView: "expanded" | "minimized",
): TrayView {
  return view === "dismissed" ? lastOpenView : "dismissed";
}

// The same grouping the "All" filter's sub-headers use, so the visual
// sections can never drift from the sort order.
export type TrayStatusGroup = "complete" | "failed" | "processing" | "review";

const groupByOrder: Record<number, TrayStatusGroup> = {
  0: "processing",
  1: "complete",
  2: "review",
  3: "failed",
};

export function statusGroup(status: TrayStatus): TrayStatusGroup {
  return groupByOrder[statusOrder[status]];
}

export function sortItems(items: readonly TrayItem[]): TrayItem[] {
  return [...items].sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status],
  );
}

// A server row whose documentId matches a session item is folded into it -
// the session item wins on identity (it carries the file name the user just
// chose), but borrows the server's extracted meta/reasons as soon as they
// exist, rather than waiting for a hard refresh to show them. A completed
// server row that isn't part of this session is dropped entirely: the tray
// only surfaces documents this session finished, not the whole archive.
export function mergeItems(
  sessionItems: readonly TrayItem[],
  serverItems: readonly TrayItem[],
): TrayItem[] {
  const serverByDocumentId = new Map(
    serverItems.flatMap((item) =>
      item.documentId ? [[item.documentId, item] as const] : [],
    ),
  );

  const enrichedSessionItems = sessionItems.map((item) => {
    const match = item.documentId
      ? serverByDocumentId.get(item.documentId)
      : undefined;
    if (!match) return item;
    return {
      ...item,
      meta: item.meta ?? match.meta,
      reasons:
        item.reasons && item.reasons.length > 0 ? item.reasons : match.reasons,
    };
  });

  const sessionDocumentIds = new Set(
    sessionItems.flatMap((item) => (item.documentId ? [item.documentId] : [])),
  );
  const standaloneServerItems = serverItems.filter(
    (item) => !sessionDocumentIds.has(item.id) && item.status !== "complete",
  );

  return sortItems([...enrichedSessionItems, ...standaloneServerItems]);
}

const backlogSectionStatus: Record<keyof InboxBacklogResponse, TrayStatus> = {
  failed: "processing-failed",
  needsReview: "needs-review",
  processing: "processing",
  recentlyCompleted: "complete",
};

function backlogRowMeta(row: InboxBacklogRow): string {
  return [
    row.transactionDate ? formatDate(row.transactionDate) : null,
    row.total ? formatMoney(row.total, row.currency) : null,
    row.categoryName,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

export function backlogToTrayItems(backlog: InboxBacklogResponse): TrayItem[] {
  return (
    Object.keys(backlogSectionStatus) as (keyof InboxBacklogResponse)[]
  ).flatMap((section) =>
    backlog[section].map((row) => ({
      documentId: row.id,
      id: row.id,
      kind: "document" as const,
      meta: backlogRowMeta(row),
      name: row.supplierName ?? "ספק לא ידוע",
      reasons: row.reasons,
      status: backlogSectionStatus[section],
    })),
  );
}

type UploadApiResult = Omit<SharedUploadResult, "fileName">;

const duplicateNotice = "מקור זהה כבר נמצא בארכיון המסמכים שלכם.";

/*
 * One result, one tray row, whichever door the file came through: the browser
 * upload that just finished, or a share the server ingested before the page
 * loaded. Keeping the mapping in one place is what makes the two look alike.
 */
function trayItemFields(result: UploadApiResult): Partial<TrayItem> {
  const status: TrayStatus =
    result.status === "uploaded" ? "processing" : result.status;
  return {
    // Only ever set, never cleared: a failed "upload anyway" must keep the
    // document it was copying from so the button still works on the retry.
    ...(result.documentId ? { documentId: result.documentId } : {}),
    message:
      result.message ?? (status === "duplicate" ? duplicateNotice : undefined),
    progress: status === "processing" ? 100 : 0,
    status,
  };
}

/*
 * Share results become session items rather than being left to the server
 * backlog poll, which drops anything already complete and knows supplier names
 * rather than file names. Re-landing on the same URL — a refresh — must not
 * list the same document twice.
 */
export function shareToTrayItems(
  results: readonly SharedUploadResult[],
  existing: readonly TrayItem[],
): TrayItem[] {
  const known = new Set(
    existing.flatMap((item) => (item.documentId ? [item.documentId] : [])),
  );
  return results.flatMap((result) =>
    result.documentId && known.has(result.documentId)
      ? []
      : [
          {
            id: crypto.randomUUID(),
            kind: "upload" as const,
            name: result.fileName,
            ...trayItemFields(result),
          } as TrayItem,
        ],
  );
}

/** A file this page holds, or the stored original of an already-shared one. */
type UploadSource = File | { copyOf: string; name: string };

function uploadFile(
  source: UploadSource,
  allowDuplicate: boolean,
  onProgress: (progress: number) => void,
): Promise<UploadApiResult> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();
    if (source instanceof File) {
      formData.append("files", source);
    } else {
      formData.append("copyOf", source.copyOf);
      formData.append("fileName", source.name);
    }
    if (allowDuplicate) {
      formData.append("allowDuplicate", "true");
    }

    request.open("POST", "/api/documents/upload");
    request.responseType = "json";
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      const result = request.response?.results?.[0] as
        UploadApiResult | undefined;
      resolve(
        result ?? {
          message: "לא ניתן היה להעלות את הקובץ. נסו שוב.",
          status: "failed",
        },
      );
    });
    request.addEventListener("error", () => {
      resolve({
        message: "ההעלאה נקטעה. נסו שוב.",
        status: "failed",
      });
    });
    request.send(formData);
  });
}

type ProcessingStatusResult = { id: string; status: DocumentStatus };

function trayStatusFromDocumentStatus(status: DocumentStatus): TrayStatus {
  return status === "READY"
    ? "complete"
    : status === "NEEDS_REVIEW"
      ? "needs-review"
      : status === "FAILED"
        ? "processing-failed"
        : "processing";
}

const statusPollIntervalMs = 5_000;
const statusPollChunkSize = 50;

async function fetchDocumentStatuses(
  documentIds: readonly string[],
): Promise<ProcessingStatusResult[]> {
  const chunks: string[][] = [];
  for (
    let index = 0;
    index < documentIds.length;
    index += statusPollChunkSize
  ) {
    chunks.push(documentIds.slice(index, index + statusPollChunkSize));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const response = await fetch("/api/documents/processing/status", {
        body: JSON.stringify({ documentIds: chunk }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) return [];
      const { documents } = (await response.json()) as {
        documents: ProcessingStatusResult[];
      };
      return documents;
    }),
  );

  return results.flat();
}

type UploadTrayContextValue = {
  addFiles: (files: FileList | File[]) => void;
  adoptSharedUploads: (results: readonly SharedUploadResult[]) => void;
  allowDuplicateUpload: (item: TrayItem) => void;
  counts: { all: number; failed: number; processing: number; review: number };
  dismiss: () => void;
  filter: TrayFilter;
  items: TrayItem[];
  minimize: () => void;
  open: () => void;
  removeItem: (id: string) => void;
  retryProcessing: (item: TrayItem) => void;
  retryUpload: (item: TrayItem) => void;
  setFilter: (filter: TrayFilter) => void;
  toggleOpen: () => void;
  toggleSize: () => void;
  view: TrayView;
};

const UploadTrayContext = createContext<UploadTrayContextValue | null>(null);

export function useUploadTray(): UploadTrayContextValue {
  const context = useContext(UploadTrayContext);
  if (!context) {
    throw new Error("useUploadTray must be used within UploadTrayProvider");
  }
  return context;
}

export function UploadTrayProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const filesRef = useRef(new Map<string, File>());
  const [sessionItems, setSessionItems] = useState<TrayItem[]>([]);
  const [serverItems, setServerItems] = useState<TrayItem[]>([]);
  const [view, setView] = useState<TrayView>("dismissed");
  const [lastOpenView, setLastOpenView] = useState<"expanded" | "minimized">(
    "expanded",
  );
  const [filter, setFilter] = useState<TrayFilter>("all");

  const items = useMemo(
    () => mergeItems(sessionItems, serverItems),
    [sessionItems, serverItems],
  );

  const counts = useMemo(
    () => ({
      all: items.length,
      failed: items.filter((item) => matchesFilter(item, "failed")).length,
      processing: items.filter((item) => matchesFilter(item, "processing"))
        .length,
      review: items.filter((item) => matchesFilter(item, "review")).length,
    }),
    [items],
  );

  function updateSessionItem(id: string, update: Partial<TrayItem>): void {
    setSessionItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item)),
    );
  }

  const refetchBacklog = useCallback(async () => {
    if (document.hidden) return;
    try {
      const response = await fetch("/api/documents/inbox");
      if (!response.ok) return;
      const backlog = (await response.json()) as InboxBacklogResponse;
      setServerItems(backlogToTrayItems(backlog));
    } catch {
      // A missed refetch keeps the previously known backlog on screen.
    }
  }, []);

  // Initial seed: the header badge must show a count even while dismissed.
  useEffect(() => {
    void refetchBacklog();
  }, [refetchBacklog]);

  useEffect(() => {
    void refetchBacklog();
  }, [pathname, refetchBacklog]);

  useEffect(() => {
    if (view === "dismissed") return;
    void refetchBacklog();
  }, [view, refetchBacklog]);

  useEffect(() => {
    function handleVisibilityChange(): void {
      if (!document.hidden) void refetchBacklog();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refetchBacklog]);

  // A primitive key, not the item objects, so progress ticks (which don't
  // change who's "processing") don't tear down and rebuild the interval.
  const pollKey = useMemo(
    () =>
      sessionItems
        .flatMap((item) =>
          item.documentId && item.status === "processing"
            ? [item.documentId]
            : [],
        )
        .join(","),
    [sessionItems],
  );

  useEffect(() => {
    if (!pollKey) return;
    const documentIds = pollKey.split(",");

    let cancelled = false;
    async function poll(): Promise<void> {
      if (document.hidden || cancelled) return;
      try {
        const statuses = await fetchDocumentStatuses(documentIds);
        if (cancelled) return;
        let reachedTerminal = false;
        const statusById = new Map(
          statuses.map((entry) => [entry.id, entry.status]),
        );
        setSessionItems((current) =>
          current.map((item) => {
            const status = item.documentId
              ? statusById.get(item.documentId)
              : undefined;
            if (!status) return item;
            const next = trayStatusFromDocumentStatus(status);
            if (next === item.status) return item;
            if (next !== "processing") reachedTerminal = true;
            return { ...item, status: next };
          }),
        );
        if (reachedTerminal) void refetchBacklog();
      } catch {
        // A missed poll does not change the durable processing task.
      }
    }

    void poll();
    const interval = window.setInterval(
      () => void poll(),
      statusPollIntervalMs,
    );
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pollKey, refetchBacklog]);

  // A new item entering "processing" pulls the tray into view - open (to
  // whichever form factor the user last had open) and focused on the
  // Processing chip, so the user sees exactly what's in flight.
  const focusProcessing = useCallback(() => {
    setFilter("processing");
    setView((current) => (current === "dismissed" ? lastOpenView : current));
  }, [lastOpenView]);

  const submit = useCallback(
    async (id: string, source: UploadSource, allowDuplicate = false) => {
      updateSessionItem(id, {
        message: undefined,
        progress: 0,
        status: "uploading",
      });
      const result = await uploadFile(source, allowDuplicate, (progress) =>
        updateSessionItem(id, { progress }),
      );
      const fields = trayItemFields(result);
      updateSessionItem(id, fields);
      if (fields.status === "processing") focusProcessing();
      void refetchBacklog();
    },
    [focusProcessing, refetchBacklog],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const added = Array.from(files);
      if (added.length === 0) return;

      const newItems: TrayItem[] = added.map((file) => {
        const id = crypto.randomUUID();
        filesRef.current.set(id, file);
        return {
          id,
          kind: "upload",
          name: file.name,
          progress: 0,
          status: "queued",
        };
      });
      setSessionItems((current) => [...current, ...newItems]);
      setView((current) =>
        current === "dismissed" ? viewAfterOpen(lastOpenView) : current,
      );

      for (const item of newItems) {
        const file = filesRef.current.get(item.id);
        if (file) void submit(item.id, file);
      }
    },
    [lastOpenView, submit],
  );

  const adoptSharedUploads = useCallback(
    (results: readonly SharedUploadResult[]) => {
      setSessionItems((current) => {
        const added = shareToTrayItems(results, current);
        return added.length === 0 ? current : [...current, ...added];
      });
      setView((current) =>
        current === "dismissed" ? viewAfterOpen(lastOpenView) : current,
      );
      if (results.some((result) => result.status === "uploaded")) {
        focusProcessing();
      }
      void refetchBacklog();
    },
    [focusProcessing, lastOpenView, refetchBacklog],
  );

  const retryUpload = useCallback(
    (item: TrayItem) => {
      const file = filesRef.current.get(item.id);
      if (!file) return;
      void submit(item.id, file);
    },
    [submit],
  );

  const allowDuplicateUpload = useCallback(
    (item: TrayItem) => {
      // A shared duplicate has no file here - the share target ingested it
      // server-side - but it does carry the existing document to copy from.
      const source =
        filesRef.current.get(item.id) ??
        (item.documentId
          ? { copyOf: item.documentId, name: item.name }
          : undefined);
      if (!source) return;
      void submit(item.id, source, true);
    },
    [submit],
  );

  // The one retry-processing code path: works for a document from this
  // session's upload or from the server backlog alike.
  const retryProcessing = useCallback(
    (item: TrayItem) => {
      if (!item.documentId) return;
      if (item.kind === "upload") {
        updateSessionItem(item.id, {
          message: undefined,
          status: "processing",
        });
      } else {
        setSessionItems((current) => [
          ...current,
          {
            ...item,
            kind: "upload",
            message: undefined,
            status: "processing",
          },
        ]);
      }
      focusProcessing();

      void (async () => {
        try {
          const response = await fetch("/api/documents/processing/retry", {
            body: JSON.stringify({ documentId: item.documentId }),
            headers: { "content-type": "application/json" },
            method: "POST",
          });
          const result = (await response.json()) as { queued?: boolean };
          if (!response.ok || !result.queued) {
            updateSessionItem(item.id, {
              message: "לא ניתן היה להכניס את העיבוד לתור. נסו שוב.",
              status: "processing-failed",
            });
          }
        } catch {
          updateSessionItem(item.id, {
            message: "לא ניתן היה להכניס את העיבוד לתור. נסו שוב.",
            status: "processing-failed",
          });
        }
      })();
    },
    [focusProcessing],
  );

  const removeItem = useCallback((id: string) => {
    filesRef.current.delete(id);
    setSessionItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const open = useCallback(
    () => setView(viewAfterOpen(lastOpenView)),
    [lastOpenView],
  );

  const toggleOpen = useCallback(() => {
    setView((current) => viewAfterToggleOpen(current, lastOpenView));
  }, [lastOpenView]);

  const toggleSize = useCallback(() => {
    setView((current) => {
      const next = current === "expanded" ? "minimized" : "expanded";
      setLastOpenView(next);
      return next;
    });
  }, []);

  const dismiss = useCallback(() => setView("dismissed"), []);

  // Mobile only: navigating via the tab bar minimizes an expanded tray
  // rather than leaving it covering the destination page.
  const minimize = useCallback(() => {
    setView((current) => {
      if (current !== "expanded") return current;
      setLastOpenView("minimized");
      return "minimized";
    });
  }, []);

  const value: UploadTrayContextValue = {
    addFiles,
    adoptSharedUploads,
    allowDuplicateUpload,
    counts,
    dismiss,
    filter,
    items,
    minimize,
    open,
    removeItem,
    retryProcessing,
    retryUpload,
    setFilter,
    toggleOpen,
    toggleSize,
    view,
  };

  return (
    <UploadTrayContext.Provider value={value}>
      {children}
    </UploadTrayContext.Provider>
  );
}
