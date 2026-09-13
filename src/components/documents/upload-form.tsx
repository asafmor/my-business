"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

const acceptedMimeTypes = "image/jpeg,image/png,image/webp,application/pdf";

type UploadStatus =
  "complete" | "duplicate" | "failed" | "queued" | "rejected" | "uploading";

type UploadCard = {
  file: File;
  id: string;
  message?: string;
  progress: number;
  status: UploadStatus;
};

type UploadApiResult = {
  message?: string;
  status: "duplicate" | "failed" | "rejected" | "uploaded";
};

function createCard(file: File): UploadCard {
  return {
    file,
    id: crypto.randomUUID(),
    progress: 0,
    status: "queued",
  };
}

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

function statusLabel(status: UploadStatus): string {
  return {
    complete: "Uploaded",
    duplicate: "Possible duplicate",
    failed: "Upload failed",
    queued: "Ready to upload",
    rejected: "Not accepted",
    uploading: "Uploading",
  }[status];
}

export function UploadForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [cards, setCards] = useState<UploadCard[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  function updateCard(id: string, update: Partial<UploadCard>): void {
    setCards((current) =>
      current.map((card) => (card.id === id ? { ...card, ...update } : card)),
    );
  }

  function addFiles(files: FileList | File[]): void {
    const added = Array.from(files).map(createCard);
    if (added.length > 0) {
      setCards((current) => [...current, ...added]);
    }
  }

  function handlePickerChange(event: ChangeEvent<HTMLInputElement>): void {
    if (event.target.files) {
      addFiles(event.target.files);
    }
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  async function submit(
    card: UploadCard,
    allowDuplicate = false,
  ): Promise<void> {
    updateCard(card.id, {
      message: undefined,
      progress: 0,
      status: "uploading",
    });
    const result = await uploadFile(card.file, allowDuplicate, (progress) => {
      updateCard(card.id, { progress });
    });
    const status: UploadStatus =
      result.status === "uploaded" ? "complete" : result.status;
    updateCard(card.id, {
      message:
        result.message ??
        (status === "duplicate"
          ? "An identical original is already in your document archive."
          : undefined),
      progress: status === "complete" ? 100 : 0,
      status,
    });
  }

  async function submitQueuedFiles(): Promise<void> {
    for (const card of cards.filter((card) => card.status === "queued")) {
      await submit(card);
    }
  }

  return (
    <section aria-labelledby="upload-panel-title" className="upload-panel">
      <div className="upload-panel__intro">
        <h2 id="upload-panel-title">Add originals securely</h2>
        <p>JPEG, PNG, WebP, or PDF. Each file can be up to 10 MB.</p>
      </div>
      <div
        aria-label="Drop documents here"
        className={
          isDragging ? "upload-dropzone is-dragging" : "upload-dropzone"
        }
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) {
            setIsDragging(false);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <p>Drag files here, or choose them from your device.</p>
        <div className="upload-dropzone__actions">
          <button
            className="button button--primary"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Choose files
          </button>
          <button
            className="button button--secondary"
            onClick={() => cameraInputRef.current?.click()}
            type="button"
          >
            Take photo
          </button>
        </div>
        <input
          accept={acceptedMimeTypes}
          className="sr-only"
          multiple
          onChange={handlePickerChange}
          ref={fileInputRef}
          type="file"
        />
        <input
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          onChange={handlePickerChange}
          ref={cameraInputRef}
          type="file"
        />
      </div>
      {cards.length > 0 ? (
        <div aria-live="polite" className="upload-queue">
          <div className="upload-queue__header">
            <h2>Upload queue</h2>
            <button
              className="button button--primary"
              disabled={!cards.some((card) => card.status === "queued")}
              onClick={submitQueuedFiles}
              type="button"
            >
              Upload selected
            </button>
          </div>
          <ul>
            {cards.map((card) => (
              <li
                className={`upload-card upload-card--${card.status}`}
                key={card.id}
              >
                <div className="upload-card__details">
                  <strong>{card.file.name}</strong>
                  <span>
                    {Math.ceil(card.file.size / 1024)} KB{" "}
                    <span aria-hidden="true">/</span> {statusLabel(card.status)}
                  </span>
                </div>
                {card.status === "uploading" ? (
                  <progress max="100" value={card.progress}>
                    {card.progress}%
                  </progress>
                ) : null}
                {card.message ? <p>{card.message}</p> : null}
                <div className="upload-card__actions">
                  {card.status === "duplicate" ? (
                    <button
                      className="button button--secondary"
                      onClick={() => submit(card, true)}
                      type="button"
                    >
                      Upload anyway
                    </button>
                  ) : null}
                  {card.status === "failed" ? (
                    <button
                      className="button button--secondary"
                      onClick={() => submit(card)}
                      type="button"
                    >
                      Retry
                    </button>
                  ) : null}
                  {card.status !== "uploading" && card.status !== "complete" ? (
                    <button
                      className="text-button"
                      onClick={() =>
                        setCards((current) =>
                          current.filter((entry) => entry.id !== card.id),
                        )
                      }
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="upload-panel__note">
        You can continue working as each file finishes. Uploaded originals are
        saved immediately and are not changed by later processing.
      </p>
    </section>
  );
}
