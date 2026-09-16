"use client";

import { useEffect, useRef } from "react";

import type { SharedUploadResult } from "../../domain/documents/shared-upload";

import { useUploadTray } from "./upload-tray-provider";

/*
 * An Android share ingests on the server and lands on the upload page. Handing
 * what it ingested to the tray on mount is what makes a share behave like any
 * other upload. The ref keeps a re-render — or React's development double
 * effect — from adopting the same share twice.
 */
export function SharedUploads({ results }: { results: SharedUploadResult[] }) {
  const { adoptSharedUploads } = useUploadTray();
  const adopted = useRef(false);

  useEffect(() => {
    if (adopted.current || results.length === 0) return;
    adopted.current = true;
    adoptSharedUploads(results);
  }, [adoptSharedUploads, results]);

  return null;
}
