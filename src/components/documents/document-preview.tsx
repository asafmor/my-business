import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Paperclip,
} from "lucide-react";

import type { DocumentFile } from "../../domain/documents/types";
import { formatBytes } from "../../lib/format";

function fileKindLabel(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/")) {
    return mimeType.slice("image/".length).toUpperCase();
  }
  return mimeType;
}

/**
 * The original, as close to full size as the column allows. Images show
 * inline; a PDF gets the browser's own viewer on desktop and a tile with an
 * "Open" button on a phone, where an embedded PDF is a blank box at best.
 */
export function DocumentPreview({
  file,
  name,
  url,
}: {
  file: DocumentFile | null;
  name: string;
  url: string | null;
}) {
  if (!file || !url) {
    return (
      <section aria-label="Original document" className="preview-card">
        <p className="detail-card__empty">No file on record.</p>
      </section>
    );
  }

  const isImage = file.mimeType.startsWith("image/");
  const isPdf = file.mimeType === "application/pdf";
  const Icon = isImage ? ImageIcon : isPdf ? FileText : Paperclip;
  const kind = fileKindLabel(file.mimeType);

  return (
    <section aria-label="Original document" className="preview-card">
      <header className="preview-card__bar">
        <span aria-hidden="true" className="preview-card__tile">
          <Icon size={13} strokeWidth={1.7} />
        </span>
        <span className="preview-card__name">
          Original · {kind} ·{" "}
          <span className="num">{formatBytes(file.sizeBytes)}</span>
        </span>
        <a
          className="button button--secondary button--small preview-card__open"
          href={url}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden size={12} strokeWidth={2} />
          Open
        </a>
      </header>

      {isImage ? (
        <a
          className="preview-card__image"
          href={url}
          rel="noreferrer"
          target="_blank"
          title="Open full size"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={`Original document from ${name}`} src={url} />
        </a>
      ) : isPdf ? (
        <>
          <iframe
            className="preview-card__frame"
            loading="lazy"
            src={`${url}#toolbar=0&navpanes=0`}
            title={`Original document from ${name}`}
          />
          <a
            className="preview-card__file"
            href={url}
            rel="noreferrer"
            target="_blank"
          >
            <FileText aria-hidden size={28} strokeWidth={1.4} />
            <span className="preview-card__file-text">
              <span className="preview-card__file-title">Open the PDF</span>
              <span className="preview-card__file-note">
                Opens in a new tab with your PDF viewer.
              </span>
            </span>
          </a>
        </>
      ) : (
        <a
          className="preview-card__file"
          href={url}
          rel="noreferrer"
          target="_blank"
        >
          <Paperclip aria-hidden size={28} strokeWidth={1.4} />
          <span className="preview-card__file-text">
            <span className="preview-card__file-title">Open the file</span>
            <span className="preview-card__file-note">
              This type has no inline preview.
            </span>
          </span>
        </a>
      )}
    </section>
  );
}
