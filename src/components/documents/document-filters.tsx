import Link from "next/link";

import { documentStatuses, documentTypes } from "../../domain/documents/types";
import { humanizeEnumValue } from "../../lib/format";
import type { DocumentListQuery } from "../../domain/documents/query";

// Page and sort always carry a value and narrow nothing, so they don't count.
function activeFilterCount(query: DocumentListQuery): number {
  return Object.entries(query).filter(
    ([key, value]) =>
      key !== "page" && key !== "sort" && value !== null && value !== "",
  ).length;
}

export function DocumentFilters({
  categories,
  query,
}: {
  categories: { id: string; name: string }[];
  query: DocumentListQuery;
}) {
  const active = activeFilterCount(query);

  return (
    <details className="filters disclosure" open={active > 0}>
      <summary className="disclosure__summary">
        <span>Filters</span>
        {active > 0 ? (
          <span className="filters__count">{active} active</span>
        ) : (
          <span className="filters__hint">Search, supplier, dates, amount</span>
        )}
      </summary>
      <form className="filters-form" method="GET">
        <div className="field">
          <label htmlFor="q">Search</label>
          <input
            className="form-control"
            defaultValue={query.q ?? ""}
            id="q"
            name="q"
            type="search"
          />
        </div>
        <div className="field">
          <label htmlFor="supplier">Supplier</label>
          <input
            className="form-control"
            defaultValue={query.supplier ?? ""}
            id="supplier"
            name="supplier"
            type="text"
          />
        </div>
        <div className="field">
          <label htmlFor="type">Type</label>
          <select
            className="form-control"
            defaultValue={query.type ?? ""}
            id="type"
            name="type"
          >
            <option value="">All</option>
            {documentTypes.map((type) => (
              <option key={type} value={type}>
                {humanizeEnumValue(type)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <select
            className="form-control"
            defaultValue={query.categoryId ?? ""}
            id="category"
            name="category"
          >
            <option value="">All</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            className="form-control"
            defaultValue={query.status ?? ""}
            id="status"
            name="status"
          >
            <option value="">All</option>
            {documentStatuses.map((status) => (
              <option key={status} value={status}>
                {humanizeEnumValue(status)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="month">Month</label>
          <input
            className="form-control"
            defaultValue={query.month ?? ""}
            id="month"
            name="month"
            type="month"
          />
        </div>
        <div className="field">
          <label htmlFor="dateFrom">From</label>
          <input
            className="form-control"
            defaultValue={query.dateFrom ?? ""}
            id="dateFrom"
            name="dateFrom"
            type="date"
          />
        </div>
        <div className="field">
          <label htmlFor="dateTo">To</label>
          <input
            className="form-control"
            defaultValue={query.dateTo ?? ""}
            id="dateTo"
            name="dateTo"
            type="date"
          />
        </div>
        <div className="field">
          <label htmlFor="amountMin">Min amount</label>
          <input
            className="form-control"
            defaultValue={query.amountMin ?? ""}
            id="amountMin"
            min="0"
            name="amountMin"
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
            name="amountMax"
            step="0.01"
            type="number"
          />
        </div>
        <div className="field">
          <label htmlFor="sort">Sort</label>
          <select
            className="form-control"
            defaultValue={query.sort}
            id="sort"
            name="sort"
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="total-desc">Total: high to low</option>
            <option value="total-asc">Total: low to high</option>
          </select>
        </div>
        <div className="filters-form__actions">
          <button className="button button--primary" type="submit">
            Apply
          </button>
          <Link className="text-button" href="/documents">
            Clear
          </Link>
        </div>
      </form>
    </details>
  );
}
