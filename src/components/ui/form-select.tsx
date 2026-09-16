"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

import { useDismiss } from "../documents/filter-menu";

export type FormSelectOption = { label: string; value: string };

/**
 * A form field's dropdown, in the filter bar's language: a well that opens the
 * same hand-built menu the filter chips use, with a drawn chevron and a tick on
 * the chosen row. On a phone the native picker is better than anything drawn,
 * so the same `<select>` that carries the value for the form shows there
 * instead (the CSS swaps the two at the phone breakpoint).
 */
export function FormSelect({
  describedBy,
  flagged,
  id,
  invalid,
  labelId,
  name,
  onChange,
  options,
  value,
}: {
  describedBy?: string;
  flagged?: boolean;
  id: string;
  invalid?: boolean;
  labelId: string;
  name: string;
  onChange: (value: string) => void;
  options: readonly FormSelectOption[];
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const chosen = options.find((option) => option.value === value);

  function step(direction: 1 | -1) {
    const index = options.findIndex((option) => option.value === value);
    const next = options[index + direction];
    if (next) onChange(next.value);
  }

  return (
    <div className="form-select" ref={ref}>
      <select
        aria-describedby={describedBy}
        aria-invalid={invalid ? true : undefined}
        className="form-control form-select__native"
        data-flagged={flagged ? "" : undefined}
        id={id}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        aria-describedby={describedBy}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={invalid ? true : undefined}
        aria-labelledby={labelId}
        className="form-control form-select__trigger"
        data-flagged={flagged ? "" : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            step(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            step(-1);
          }
        }}
        type="button"
      >
        <span className="form-select__text">{chosen?.label ?? value}</span>
        <ChevronDown aria-hidden size={12} strokeWidth={2.4} />
      </button>

      {open ? (
        <div className="filter-menu form-select__menu">
          <ul className="filter-menu__list" role="listbox">
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    aria-selected={selected}
                    className={`filter-menu__item${selected ? " is-selected" : ""}`}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    role="option"
                    type="button"
                  >
                    <span className="filter-menu__item-text">
                      {option.label}
                    </span>
                    {selected ? (
                      <Check aria-hidden size={12} strokeWidth={2.6} />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
