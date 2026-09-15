"use client";

import type { ReactNode } from "react";

import { useUploadTray } from "./upload-tray-provider";

export function OpenTrayButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { open } = useUploadTray();

  return (
    <button className={className} onClick={open} type="button">
      {children}
    </button>
  );
}
