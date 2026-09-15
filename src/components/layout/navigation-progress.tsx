"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const startEvent = "my-business:navigation-start";

/**
 * Raises the indicator for a navigation that did not come from a link —
 * `router.push` from a filter or a pager has nothing for the click listener to
 * see.
 */
export function signalNavigationStart(): void {
  window.dispatchEvent(new Event(startEvent));
}

/**
 * One indicator for every route change. The App Router exposes no global
 * navigation events, so the start is read from the click that causes it and the
 * end from the URL the router lands on.
 *
 * ponytail: a delegated click listener, not router instrumentation. If Next
 * ever ships global navigation events, swap the listener for those.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  /* Arriving is what ends the wait, and a new URL is how arriving looks. */
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleClick(event: MouseEvent): void {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return;

      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;

      // Downloads, new tabs, other origins and same-page hashes never unmount
      // the current route, so they must never raise the indicator.
      if (anchor.hasAttribute("download")) return;
      if (anchor.target !== "" && anchor.target !== "_self") return;
      if (anchor.origin !== window.location.origin) return;
      if (anchor.href === window.location.href) return;

      setIsNavigating(true);
    }

    function handleStart(): void {
      setIsNavigating(true);
    }

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("popstate", handleStart);
    window.addEventListener(startEvent, handleStart);
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("popstate", handleStart);
      window.removeEventListener(startEvent, handleStart);
    };
  }, []);

  if (!isNavigating) return null;

  return (
    <div aria-live="polite" className="navigation-progress" role="status">
      <LoaderCircle
        aria-hidden
        className="navigation-progress__spinner"
        size={13}
        strokeWidth={2.4}
      />
      Loading…
    </div>
  );
}
