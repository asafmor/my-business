"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Anything that opens over the page closes the same two ways: a click that
 * lands elsewhere, or Escape. Without this a stray click on a document row
 * navigates away instead of just dismissing the panel.
 */
export function useDismiss(
  isOpen: boolean,
  close: () => void,
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClick(event: MouseEvent): void {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (ref.current?.contains(target)) return;

      close();
      // The click that dismisses is spent on dismissing. Every row behind this
      // panel is a link, and closing a menu must never also open a document.
      // Another chip is the exception, so the bar stays one click wide.
      if (target.closest(".filter-chip") === null) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") close();
    }

    // Capture, so the dismissal wins over whatever the click would have hit.
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, isOpen]);

  return ref;
}

/** The chip and the panel it opens, shared by every filter on the bar. */
export function FilterPopover({
  children,
  icon,
  isOn,
  label,
  wide,
}: {
  children: (close: () => void) => ReactNode;
  icon?: ReactNode;
  isOn: boolean;
  label: string;
  wide?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useDismiss(isOpen, () => setIsOpen(false));

  return (
    <div className="filter-pop" ref={ref}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`filter-chip${isOn ? " is-on" : ""}${isOpen ? " is-open" : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {icon}
        <span className="filter-chip__text">{label}</span>
        <ChevronDown aria-hidden size={11} strokeWidth={2.4} />
      </button>
      {isOpen ? (
        <div
          className={wide ? "filter-menu filter-menu--wide" : "filter-menu"}
          role="dialog"
        >
          {children(() => setIsOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A chip whose panel is a list of choices. Built rather than borrowed from a
 * native `select`, because the OS popup brings its own type, its own blue and
 * none of this app's language.
 */
export function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  value: string;
}) {
  const chosen = options.find((option) => option.value === value);

  return (
    <FilterPopover
      isOn={value !== ""}
      label={chosen ? `${label}: ${chosen.label}` : label}
    >
      {(close) => (
        <ul className="filter-menu__list">
          {[{ label: `Any ${label.toLowerCase()}`, value: "" }, ...options].map(
            (option) => (
              <li key={option.value}>
                <button
                  className="filter-menu__item"
                  onClick={() => {
                    onChange(option.value);
                    close();
                  }}
                  type="button"
                >
                  <span className="filter-menu__item-text">{option.label}</span>
                  {option.value === value ? (
                    <Check aria-hidden size={12} strokeWidth={2.6} />
                  ) : null}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </FilterPopover>
  );
}
