"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";

import { documentStatuses, documentTypes } from "../../domain/documents/types";
import { formatMonth } from "../../lib/format";
import {
  countOf,
  documentStatusLabel,
  documentTypeLabel,
} from "../../lib/labels";
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
            aria-label="חיפוש מסמכים"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="חיפוש מסמכים"
            type="search"
            value={search}
          />
          {search ? (
            <button
              aria-label="ניקוי החיפוש"
              className="filter-search__clear"
              onClick={() => setSearch("")}
              type="button"
            >
              <X aria-hidden size={9} strokeWidth={3} />
            </button>
          ) : null}
        </div>

        <FilterSelect
          label="סוג"
          onChange={(value) => setParams({ type: value })}
          options={documentTypes.map((type) => ({
            label: documentTypeLabel(type),
            value: type,
          }))}
          value={query.type ?? ""}
        />
        <FilterSelect
          label="קטגוריה"
          onChange={(value) => setParams({ category: value })}
          options={categories.map((category) => ({
            label: category.name,
            value: category.id,
          }))}
          value={query.categoryId ?? ""}
        />
        <FilterSelect
          label="סטטוס"
          onChange={(value) => setParams({ status: value })}
          options={documentStatuses.map((status) => ({
            label: documentStatusLabel(status),
            value: status,
          }))}
          value={query.status ?? ""}
        />

        <FilterPopover
          isOn={query.month !== null}
          label={query.month ? `חודש: ${formatMonth(query.month)}` : "חודש"}
        >
          {() => (
            <div className="filter-menu__grid">
              <div className="filter-field filter-field--full">
                <label htmlFor="month">חודש</label>
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
          label={moreActive > 0 ? `עוד: ${moreActive}` : "עוד"}
          wide
        >
          {(close) => (
            <>
              <div className="filter-menu__grid">
                <MoreField
                  id="dateFrom"
                  label="מתאריך"
                  onCommit={(value) =>
                    setParams({ dateFrom: value, month: null })
                  }
                  type="date"
                  value={query.dateFrom ?? ""}
                />
                <MoreField
                  id="dateTo"
                  label="עד תאריך"
                  onCommit={(value) =>
                    setParams({ dateTo: value, month: null })
                  }
                  type="date"
                  value={query.dateTo ?? ""}
                />
                <MoreField
                  id="amountMin"
                  label="סכום מינימלי"
                  onCommit={(value) => setParams({ amountMin: value })}
                  step="0.01"
                  type="number"
                  value={query.amountMin ?? ""}
                />
                <MoreField
                  id="amountMax"
                  label="סכום מקסימלי"
                  onCommit={(value) => setParams({ amountMax: value })}
                  step="0.01"
                  type="number"
                  value={query.amountMax ?? ""}
                />
                <div className="filter-field filter-field--full">
                  <label htmlFor="supplier">ספק</label>
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
                  נבחר חודש, ולכן טווח התאריכים אינו נלקח בחשבון.
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
                  איפוס השדות האלה
                </button>
                <button
                  className="button button--secondary button--small"
                  onClick={close}
                  type="button"
                >
                  סיום
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
              ניקוי {countOf(active, "מסנן אחד", "מסננים")}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
