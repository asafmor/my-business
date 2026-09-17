"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/*
 * The only interactive thing on Settings, so the page itself stays a server
 * component: refresh() re-runs the checks in place instead of reloading, and
 * the transition is what tells us they are still running.
 */
export function RecheckButton() {
  const router = useRouter();
  const [isChecking, startChecking] = useTransition();

  return (
    <button
      className="button button--primary button--small"
      disabled={isChecking}
      onClick={() => startChecking(() => router.refresh())}
      type="button"
    >
      <RefreshCw
        aria-hidden
        className={isChecking ? "recheck-button__spinner" : undefined}
        size={13}
        strokeWidth={2}
      />
      {isChecking ? "בודק…" : "בדיקה מחדש"}
    </button>
  );
}
