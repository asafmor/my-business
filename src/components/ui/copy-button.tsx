"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

/** Copies a value to the clipboard and says so for a moment. */
export function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      aria-label={copied ? `${label} הועתק` : `העתקת ${label}`}
      className="copy-button"
      data-copied={copied ? "" : undefined}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => setCopied(true));
      }}
      title={copied ? "הועתק" : `העתקת ${label}`}
      type="button"
    >
      {copied ? (
        <Check aria-hidden size={12} strokeWidth={2.4} />
      ) : (
        <Copy aria-hidden size={12} strokeWidth={1.9} />
      )}
    </button>
  );
}
