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
export type TrayFilter = "active" | "all" | "failed" | "review";

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

const activeStatuses: readonly TrayStatus[] = [
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
    case "active":
      return activeStatuses.includes(item.status);
    case "review":
      return item.status === "needs-review";
    case "failed":
      return failedStatuses.includes(item.status);
    case "all":
      return true;
  }
}

// In-flight uploads first, then needs-review, then failed, then processing,
// then recently completed.
const statusOrder: Record<TrayStatus, number> = {
  queued: 0,
  uploading: 0,
  "needs-review": 1,
  duplicate: 2,
  failed: 2,
  "processing-failed": 2,
  rejected: 2,
  processing: 3,
  complete: 4,
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

export function sortItems(items: readonly TrayItem[]): TrayItem[] {
  return [...items].sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status],
  );
}

// A server row whose documentId matches a session item is dropped - the
// session item wins, because it carries the file name the user just chose.
export function mergeItems(
  sessionItems: readonly TrayItem[],
  serverItems: readonly TrayItem[],
): TrayItem[] {
  const sessionDocumentIds = new Set(
    sessionItems.flatMap((item) => (item.documentId ? [item.documentId] : [])),
  );
  return sortItems([
    ...sessionItems,
    ...serverItems.filter((item) => !sessionDocumentIds.has(item.id)),
  ]);
}

const backlogSectionStatus: Record<keyof InboxBacklogResponse, TrayStatus> = {
  failed: "processing-failed",
  needsReview: "needs-review",
  processing: "processing",
  recentlyCompleted: "complete",
};

function backlogRowMeta(row: InboxBacklogRow): string {
  return [
    formatDate(row.transactionDate),
    formatMoney(row.total, row.currency),
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
      name: row.supplierName ?? "Unknown supplier",
      reasons: row.reasons,
      status: backlogSectionStatus[section],
    })),
  );
}

type UploadApiResult = {
  documentId?: string;
  message?: string;
  status: "duplicate" | "failed" | "rejected" | "uploaded";
};

function uploadFile(
  file: File,
  allowDuplicate: boolean,
  onProgress: (progress: number) => void,
): Promise<UploadApiResult> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("files", file);
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
          message: "The file could not be uploaded. Please try again.",
          status: "failed",
        },
      );
    });
    request.addEventListener("error", () => {
      resolve({
        message: "The upload was interrupted. Please try again.",
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
  allowDuplicateUpload: (item: TrayItem) => void;
  counts: { active: number; all: number; failed: number; review: number };
  dismiss: () => void;
  filter: TrayFilter;
  items: TrayItem[];
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
      active: items.filter((item) => matchesFilter(item, "active")).length,
      all: items.length,
      failed: items.filter((item) => matchesFilter(item, "failed")).length,
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

  const submit = useCallback(
    async (id: string, file: File, allowDuplicate = false) => {
      updateSessionItem(id, {
        message: undefined,
        progress: 0,
        status: "uploading",
      });
      const result = await uploadFile(file, allowDuplicate, (progress) =>
        updateSessionItem(id, { progress }),
      );
      const status: TrayStatus =
        result.status === "uploaded" ? "processing" : result.status;
      updateSessionItem(id, {
        documentId: result.documentId,
        message:
          result.message ??
          (status === "duplicate"
            ? "An identical original is already in your document archive."
            : undefined),
        progress: status === "processing" ? 100 : 0,
        status,
      });
      void refetchBacklog();
    },
    [refetchBacklog],
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
      const file = filesRef.current.get(item.id);
      if (!file) return;
      void submit(item.id, file, true);
    },
    [submit],
  );

  // The one retry-processing code path: works for a document from this
  // session's upload or from the server backlog alike.
  const retryProcessing = useCallback((item: TrayItem) => {
    if (!item.documentId) return;
    if (item.kind === "upload") {
      updateSessionItem(item.id, { message: undefined, status: "processing" });
    } else {
      setSessionItems((current) => [
        ...current,
        { ...item, kind: "upload", message: undefined, status: "processing" },
      ]);
    }

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
            message: "Processing could not be queued. Please try again.",
            status: "processing-failed",
          });
        }
      } catch {
        updateSessionItem(item.id, {
          message: "Processing could not be queued. Please try again.",
          status: "processing-failed",
        });
      }
    })();
  }, []);

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

  const value: UploadTrayContextValue = {
    addFiles,
    allowDuplicateUpload,
    counts,
    dismiss,
    filter,
    items,
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
