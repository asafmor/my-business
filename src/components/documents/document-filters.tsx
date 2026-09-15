"use client";

import { ChevronDown, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { documentStatuses, documentTypes } from "../../domain/documents/types";
import { humanizeEnumValue } from "../../lib/format";
import type { DocumentListQuery } from "../../domain/documents/query";
import { useDocumentParams } from "./use-document-params";

// Page, page size and sort always carry a value and narrow nothing.
const structuralKeys = new Set(["page", "pageSize", "sort"]);

function activeFilterCount(query: DocumentListQuery): number {
  return Object.entries(query).filter(
    ([key, value]) =>
      !structuralKeys.has(key) && value !== null && value !== "",
  ).length;
}

/**
 * A chip is a label and the choice made on it, so a glance at the bar reads as a
 * sentence. The native select underneath does the picking — on a phone that is
 * the system wheel, which nothing hand-built beats.
 */
function FilterChip({
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
  const isOn = value !== "";

  return (
    <label className={isOn ? "filter-chip is-on" : "filter-chip"}>
      <span className="filter-chip__text">
        {isOn ? `${label}: ${chosen?.label ?? value}` : label}
      </span>
      <ChevronDown aria-hidden size={11} strokeWidth={2.4} />
      <select
        aria-label={label}
        className="filter-chip__select"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{label}: all</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DocumentFilters({
  categories,
  query,
}: {
  categories: { id: string; name: string }[];
  query: DocumentListQuery;
}) {
  const setParams = useDocumentParams();
  const [search, setSearch] = useState(query.q ?? "");
  const active = activeFilterCount(query);

  /* Typing should not fire a query per keystroke, nor need an Apply button. */
  useEffect(() => {
    if (search === (query.q ?? "")) return;
    const timer = setTimeout(() => setParams({ q: search }), 350);
    return () => clearTimeout(timer);
  }, [query.q, search, setParams]);

  return (
    <div className="filter-bar">
      <div className="filter-bar__row">
        <div className="filter-search">
          <Search aria-hidden size={13} strokeWidth={1.9} />
          <input
            aria-label="Search documents"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Supplier, number, notes"
            type="search"
            value={search}
          />
          {search ? (
            <button
              aria-label="Clear search"
              className="filter-search__clear"
              onClick={() => setSearch("")}
              type="button"
            >
              <X aria-hidden size={9} strokeWidth={3} />
            </button>
          ) : null}
        </div>

        <FilterChip
          label="Type"
          onChange={(value) => setParams({ type: value })}
          options={documentTypes.map((type) => ({
            label: humanizeEnumValue(type),
            value: type,
          }))}
          value={query.type ?? ""}
        />
        <FilterChip
          label="Category"
          onChange={(value) => setParams({ category: value })}
          options={categories.map((category) => ({
            label: category.name,
            value: category.id,
          }))}
          value={query.categoryId ?? ""}
        />
        <FilterChip
          label="Status"
          onChange={(value) => setParams({ status: value })}
          options={documentStatuses.map((status) => ({
            label: humanizeEnumValue(status),
            value: status,
          }))}
          value={query.status ?? ""}
        />
        <label
          className={query.month ? "filter-chip is-on" : "filter-chip"}
          title="Month"
        >
          <span className="filter-chip__text">
            {query.month ? `Month: ${query.month}` : "Month"}
          </span>
          <ChevronDown aria-hidden size={11} strokeWidth={2.4} />
          <input
            aria-label="Month"
            className="filter-chip__select"
            onChange={(event) => setParams({ month: event.target.value })}
            type="month"
            value={query.month ?? ""}
          />
        </label>

        <details className="filter-more">
          <summary className="filter-chip filter-chip--ghost">
            <Plus aria-hidden size={12} strokeWidth={2} />
            <span className="filter-chip__text">More</span>
          </summary>
          <div className="filter-more__panel">
            <div className="field">
              <label htmlFor="dateFrom">From</label>
              <input
                className="form-control"
                defaultValue={query.dateFrom ?? ""}
                id="dateFrom"
                onBlur={(event) => setParams({ dateFrom: event.target.value })}
                type="date"
              />
            </div>
            <div className="field">
              <label htmlFor="dateTo">To</label>
              <input
                className="form-control"
                defaultValue={query.dateTo ?? ""}
                id="dateTo"
                onBlur={(event) => setParams({ dateTo: event.target.value })}
                type="date"
              />
            </div>
            <div className="field">
              <label htmlFor="supplier">Supplier</label>
              <input
                className="form-control"
                defaultValue={query.supplier ?? ""}
                id="supplier"
                onBlur={(event) => setParams({ supplier: event.target.value })}
                type="text"
              />
            </div>
            <div className="field">
              <label htmlFor="amountMin">Min amount</label>
              <input
                className="form-control"
                defaultValue={query.amountMin ?? ""}
                id="amountMin"
                min="0"
                onBlur={(event) => setParams({ amountMin: event.target.value })}
                step="0.01"
                type="number"
              />
            </div>
            <div className="field">
              <label htmlFor="amountMax">Max amount</label>
              <input
                className="form-control"
                defaultValue={query.amountMax ?? ""}
                id="amountMax"
                min="0"
                onBlur={(event) => setParams({ amountMax: event.target.value })}
                step="0.01"
                type="number"
              />
            </div>
          </div>
        </details>

        <span className="filter-bar__spacer" />

        {active > 0 ? (
          <button
            className="filter-chip filter-chip--ghost"
            onClick={() =>
              setParams({
                amountMax: null,
                amountMin: null,
                category: null,
                dateFrom: null,
                dateTo: null,
                month: null,
                q: null,
                status: null,
                supplier: null,
                type: null,
              })
            }
            type="button"
          >
            <X aria-hidden size={11} strokeWidth={2.4} />
            <span className="filter-chip__text">
              Clear {active} filter{active === 1 ? "" : "s"}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
