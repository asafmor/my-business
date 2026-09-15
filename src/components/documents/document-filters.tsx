"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";

import { documentStatuses, documentTypes } from "../../domain/documents/types";
import { humanizeEnumValue } from "../../lib/format";
import type { DocumentListQuery } from "../../domain/documents/query";
import {
  activeFilterCount,
  clearedFilters,
} from "../../domain/documents/query";
import { FilterPopover, FilterSelect } from "./filter-menu";
import { useDocumentParams } from "./use-document-params";

const moreKeys = [
  "dateFrom",
  "dateTo",
  "supplier",
  "amountMin",
  "amountMax",
] as const;

function MoreField({
  id,
  label,
  onCommit,
  step,
  type,
  value,
}: {
  id: string;
  label: string;
  onCommit: (value: string) => void;
  step?: string;
  type: string;
  value: string;
}) {
  return (
    <div className="filter-field">
      <label htmlFor={id}>{label}</label>
      <input
        className="filter-field__input"
        defaultValue={value}
        id={id}
        onBlur={(event) => onCommit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        step={step}
        type={type}
      />
    </div>
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
  const moreActive = moreKeys.filter((key) => query[key]).length;

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
            placeholder="Search documents"
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

        <FilterSelect
          label="Type"
          onChange={(value) => setParams({ type: value })}
          options={documentTypes.map((type) => ({
            label: humanizeEnumValue(type),
            value: type,
          }))}
          value={query.type ?? ""}
        />
        <FilterSelect
          label="Category"
          onChange={(value) => setParams({ category: value })}
          options={categories.map((category) => ({
            label: category.name,
            value: category.id,
          }))}
          value={query.categoryId ?? ""}
        />
        <FilterSelect
          label="Status"
          onChange={(value) => setParams({ status: value })}
          options={documentStatuses.map((status) => ({
            label: humanizeEnumValue(status),
            value: status,
          }))}
          value={query.status ?? ""}
        />

        <FilterPopover
          isOn={query.month !== null}
          label={query.month ? `Month: ${query.month}` : "Month"}
        >
          {() => (
            <div className="filter-menu__grid">
              <div className="filter-field filter-field--full">
                <label htmlFor="month">Month</label>
                <input
                  className="filter-field__input"
                  defaultValue={query.month ?? ""}
                  id="month"
                  onChange={(event) => setParams({ month: event.target.value })}
                  type="month"
                />
              </div>
            </div>
          )}
        </FilterPopover>

        <FilterPopover
          icon={<SlidersHorizontal aria-hidden size={12} strokeWidth={2} />}
          isOn={moreActive > 0}
          label={moreActive > 0 ? `More: ${moreActive}` : "More"}
          wide
        >
          {(close) => (
            <>
              <div className="filter-menu__grid">
                <MoreField
                  id="dateFrom"
                  label="From"
                  onCommit={(value) =>
                    setParams({ dateFrom: value, month: null })
                  }
                  type="date"
                  value={query.dateFrom ?? ""}
                />
                <MoreField
                  id="dateTo"
                  label="To"
                  onCommit={(value) =>
                    setParams({ dateTo: value, month: null })
                  }
                  type="date"
                  value={query.dateTo ?? ""}
                />
                <MoreField
                  id="amountMin"
                  label="Min amount"
                  onCommit={(value) => setParams({ amountMin: value })}
                  step="0.01"
                  type="number"
                  value={query.amountMin ?? ""}
                />
                <MoreField
                  id="amountMax"
                  label="Max amount"
                  onCommit={(value) => setParams({ amountMax: value })}
                  step="0.01"
                  type="number"
                  value={query.amountMax ?? ""}
                />
                <div className="filter-field filter-field--full">
                  <label htmlFor="supplier">Supplier</label>
                  <input
                    className="filter-field__input"
                    defaultValue={query.supplier ?? ""}
                    id="supplier"
                    onBlur={(event) =>
                      setParams({ supplier: event.target.value })
                    }
                    type="text"
                  />
                </div>
              </div>
              {/* A date range and a month answer the same question, and the
                  query can only honour one. Say which one won. */}
              {query.month ? (
                <p className="filter-menu__note">
                  A month is set, so From and To are ignored.
                </p>
              ) : null}
              <div className="filter-menu__foot">
                <button
                  className="button button--ghost button--small"
                  onClick={() => {
                    setParams({
                      amountMax: null,
                      amountMin: null,
                      dateFrom: null,
                      dateTo: null,
                      month: null,
                      supplier: null,
                    });
                    close();
                  }}
                  type="button"
                >
                  Reset these
                </button>
                <button
                  className="button button--secondary button--small"
                  onClick={close}
                  type="button"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </FilterPopover>

        <span className="filter-bar__spacer" />

        {active > 0 ? (
          <button
            className="filter-chip filter-chip--ghost"
            onClick={() => {
              setSearch("");
              setParams(clearedFilters);
            }}
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
