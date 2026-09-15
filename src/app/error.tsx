"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ContentState } from "../components/ui/content-state";

// Generic fallback boundary (22.3 "generic-unexpected-error-page") for any
// page under this layout that throws without its own closer error.tsx.
// Kept deliberately plain - this is a boundary, not a diagnostics page, so
// it shows no error detail to the user.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        digest: error.digest,
        event: "app.unhandled_error",
        timestamp: new Date().toISOString(),
      }),
    );
  }, [error]);

  return (
    <div className="page">
      <ContentState
        action={
          <>
            <button
              className="button button--secondary"
              onClick={reset}
              type="button"
            >
              Try again
            </button>
            <Link className="button button--primary" href="/">
              Back to dashboard
            </Link>
          </>
        }
        description="Please try again, or go back to the dashboard. If this keeps happening, contact support."
        title="Something went wrong"
        tone="error"
      />
    </div>
  );
}
