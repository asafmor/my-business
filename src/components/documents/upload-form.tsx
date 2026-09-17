"use client";

import { Camera, FolderOpen, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { useUploadTray } from "../uploads/upload-tray-provider";

const acceptedMimeTypes = "image/jpeg,image/png,image/webp,application/pdf";

/*
 * The zone is the whole screen: one drop target on desktop, one capture card on
 * mobile whose primary action is the camera. Everything the tray already says —
 * progress, duplicates, failures — stays in the tray rather than being repeated
 * here as reassurance copy.
 */
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

  /* The buttons are the keyboard path; the zone's own click is a bonus one, so
     a click on a button must not open a second picker behind it. */
  function openPicker(
    event: { stopPropagation: () => void },
    input: HTMLInputElement | null,
  ): void {
    event.stopPropagation();
    input?.click();
  }

  return (
    <div className="upload-stage">
      <div
        aria-label="הוספת מסמכים"
        className={
          isDragging ? "upload-dropzone is-dragging" : "upload-dropzone"
        }
        onClick={() => fileInputRef.current?.click()}
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
        <span aria-hidden="true" className="upload-dropzone__mark">
          <Upload size={22} strokeWidth={1.9} />
        </span>
        <p className="upload-dropzone__lead">גררו קבצים לכאן</p>
        <p className="upload-dropzone__lead upload-dropzone__lead--touch">
          הוספת מסמך
        </p>
        <div className="upload-dropzone__actions">
          <button
            className="button button--primary upload-dropzone__camera"
            onClick={(event) => openPicker(event, cameraInputRef.current)}
            type="button"
          >
            <Camera aria-hidden size={16} strokeWidth={1.9} />
            <span>צילום</span>
          </button>
          <button
            className="button button--secondary"
            onClick={(event) => openPicker(event, fileInputRef.current)}
            type="button"
          >
            <FolderOpen aria-hidden size={16} strokeWidth={1.9} />
            <span>בחירת קבצים</span>
          </button>
        </div>
        <p className="upload-dropzone__formats">
          JPEG · PNG · WebP · PDF · עד <bdi>10 MB</bdi>
        </p>
        {/* input.click() dispatches a bubbling click; without this it would
            reach the zone and open a second picker — or loop. */}
        <input
          accept={acceptedMimeTypes}
          className="sr-only"
          multiple
          onChange={handlePickerChange}
          onClick={(event) => event.stopPropagation()}
          ref={fileInputRef}
          type="file"
        />
        <input
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          onChange={handlePickerChange}
          onClick={(event) => event.stopPropagation()}
          ref={cameraInputRef}
          type="file"
        />
      </div>
    </div>
  );
}
