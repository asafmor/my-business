"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { signalNavigationStart } from "../layout/navigation-progress";

/**
 * Every documents control edits the URL, because the URL is the query: a filter
 * is shareable, a sort survives a refresh, and the back button undoes both.
 */
export function useDocumentParams(): (
  patch: Record<string, string | null>,
) => void {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  return useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      // Narrowing or re-sorting invalidates whichever page you were on.
      if (!("page" in patch)) next.delete("page");

      const query = next.toString();
      signalNavigationStart();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );
}
