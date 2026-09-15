"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { useUploadTray } from "../uploads/upload-tray-provider";

const acceptedMimeTypes = "image/jpeg,image/png,image/webp,application/pdf";

export function UploadForm() {
  const { addFiles } = useUploadTray();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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
      <p className="upload-panel__note">
        You can continue working as each file finishes. Uploaded originals are
        saved immediately and are not changed by later processing. Track
        progress in the upload tray.
      </p>
    </section>
  );
}
