"use client";

import { Check, LoaderCircle, Pencil } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import type { DocumentEditFormState } from "../../app/(protected)/documents/[id]/actions";
import { fieldLabels } from "../../domain/documents/audit-change";
import { documentTypes } from "../../domain/documents/types";
import {
  currencySymbol,
  formatDateLong,
  formatMoney,
  humanizeEnumValue,
} from "../../lib/format";
import { FormSelect } from "../ui/form-select";

export type DocumentValues = {
  businessUsePercentage: string;
  categoryId: string | null;
  currency: string | null;
  documentNumber: string | null;
  documentType: string;
  notes: string | null;
  paymentMethod: string | null;
  subtotal: string | null;
  supplierName: string | null;
  total: string | null;
  transactionDate: string | null;
  vat: string | null;
};

type Field = keyof DocumentValues;
type Draft = Record<Field, string>;

const fields: Field[] = [
  "supplierName",
  "documentType",
  "documentNumber",
  "transactionDate",
  "currency",
  "subtotal",
  "vat",
  "total",
  "categoryId",
  "businessUsePercentage",
  "paymentMethod",
  "notes",
];

/* Three groups, in the order a bookkeeper reads a receipt. */
const groups: { fields: Field[]; label: string }[] = [
  {
    fields: [
      "supplierName",
      "documentType",
      "documentNumber",
      "transactionDate",
    ],
    label: "Document",
  },
  { fields: ["currency", "subtotal", "vat", "total"], label: "Amounts" },
  {
    fields: ["categoryId", "businessUsePercentage", "paymentMethod", "notes"],
    label: "Bookkeeping",
  },
];

const moneyFields: Field[] = ["subtotal", "vat", "total"];
const currencyOptions = ["ILS", "USD", "EUR", "GBP"];

const initialState: DocumentEditFormState = {
  error: null,
  fieldErrors: {},
  saved: 0,
};

function toDraft(values: DocumentValues): Draft {
  return Object.fromEntries(
    fields.map((field) => [field, values[field] ?? ""]),
  ) as Draft;
}

function cents(value: string): number | null {
  const amount = Number(value);
  return value.trim() !== "" && Number.isFinite(amount)
    ? Math.round(amount * 100)
    : null;
}

/**
 * What subtotal, VAT and total say about each other, as a sentence. Null when
 * a value is missing - silence beats a warning about nothing.
 */
export function reconcileAmounts(
  draft: Pick<Draft, "subtotal" | "total" | "vat">,
  currency: string | null,
): { ok: boolean; text: string } | null {
  const subtotal = cents(draft.subtotal);
  const vat = cents(draft.vat);
  const total = cents(draft.total);
  if (subtotal === null || vat === null || total === null) return null;
  const sum = subtotal + vat;
  if (sum === total)
    return { ok: true, text: "Subtotal and VAT add up to the total." };
  return {
    ok: false,
    text: `Subtotal and VAT add up to ${formatMoney((sum / 100).toFixed(2), currency)}, not the total.`,
  };
}

/** "18%" when VAT and subtotal are both known and sensible. */
export function vatRate(vat: string, subtotal: string): string | null {
  const numerator = cents(vat);
  const denominator = cents(subtotal);
  if (numerator === null || denominator === null || denominator <= 0)
    return null;
  const rate = (numerator / denominator) * 100;
  return `${Number.isInteger(rate) ? rate : rate.toFixed(1)}%`;
}

/**
 * The document's fields. On desktop it is the form, always. On a phone it is
 * a list you read first and edit on request - twelve open inputs are a lot of
 * wells to scroll past to find the total.
 */
export function DocumentDetails({
  action,
  categories,
  edited,
  flagged,
  values,
}: {
  action: (
    state: DocumentEditFormState,
    formData: FormData,
  ) => Promise<DocumentEditFormState>;
  categories: { id: string; name: string }[];
  /** Fields a person has corrected by hand, by form field name. */
  edited: readonly string[];
  /** Fields the reader should check, with the sentence saying why. */
  flagged: Readonly<Record<string, string>>;
  values: DocumentValues;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [draft, setDraft] = useState(() => toDraft(values));
  const [editing, setEditing] = useState(false);
  const [focusField, setFocusField] = useState<Field | null>(null);

  /* Fresh server values (a save, a re-read) replace the draft; a failed save
     keeps it, since the reader's corrections are the whole point. */
  const valuesKey = JSON.stringify(values);
  const [seen, setSeen] = useState({ saved: 0, valuesKey });
  if (seen.valuesKey !== valuesKey || seen.saved !== state.saved) {
    setSeen({ saved: state.saved, valuesKey });
    setDraft(toDraft(values));
    if (seen.saved !== state.saved) setEditing(false);
  }

  useEffect(() => {
    if (!editing || !focusField) return;
    document.getElementById(focusField)?.focus();
    setFocusField(null);
  }, [editing, focusField]);

  const dirty = fields.some((field) => draft[field] !== (values[field] ?? ""));
  const currency = draft.currency.trim().toUpperCase() || values.currency;
  const reconcile = reconcileAmounts(draft, currency);
  const rate = vatRate(draft.vat, draft.subtotal);
  const categoryName =
    categories.find((category) => category.id === values.categoryId)?.name ??
    null;

  function set(field: Field, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function discard() {
    setDraft(toDraft(values));
    setEditing(false);
  }

  function readValue(field: Field): { empty: boolean; text: string } {
    const value = values[field];
    switch (field) {
      case "documentType":
        return { empty: false, text: humanizeEnumValue(values.documentType) };
      case "transactionDate":
        return { empty: value === null, text: formatDateLong(value) };
      case "subtotal":
      case "vat":
      case "total":
        return {
          empty: value === null,
          text: formatMoney(value, values.currency),
        };
      case "categoryId":
        return {
          empty: categoryName === null,
          text: categoryName ?? "Uncategorised",
        };
      case "businessUsePercentage":
        return {
          empty: false,
          text: `${Number(values.businessUsePercentage) || 0}%`,
        };
      default:
        return { empty: !value, text: value ?? "—" };
    }
  }

  function label(field: Field) {
    return (
      <span className="details-label">
        {fieldLabels[field]}
        {edited.includes(field) ? (
          <span className="details-edited" title="Corrected by hand">
            <Pencil aria-hidden size={11} strokeWidth={2} />
            <span className="sr-only">Edited</span>
          </span>
        ) : null}
      </span>
    );
  }

  function note(field: Field) {
    const error = state.fieldErrors[field];
    if (error) {
      return (
        <p className="form-control__error" id={`${field}-note`}>
          {error}
        </p>
      );
    }
    if (flagged[field]) {
      return (
        <p className="details-flag" id={`${field}-note`}>
          {flagged[field]}
        </p>
      );
    }
    return null;
  }

  function control(field: Field) {
    const shared = {
      "aria-describedby":
        state.fieldErrors[field] || flagged[field]
          ? `${field}-note`
          : undefined,
      "aria-invalid": state.fieldErrors[field] ? true : undefined,
      className: "form-control",
      "data-flagged": flagged[field] ? "" : undefined,
      id: field,
      name: field,
    };
    const select = {
      describedBy: shared["aria-describedby"],
      flagged: Boolean(flagged[field]),
      id: field,
      invalid: Boolean(state.fieldErrors[field]),
      labelId: `${field}-label`,
      name: field,
    };
    switch (field) {
      case "documentType":
        return (
          <FormSelect
            {...select}
            onChange={(value) => set(field, value)}
            options={documentTypes.map((type) => ({
              label: humanizeEnumValue(type),
              value: type,
            }))}
            value={draft.documentType}
          />
        );
      case "categoryId":
        return (
          <FormSelect
            {...select}
            onChange={(value) => set(field, value)}
            options={[
              { label: "Uncategorised", value: "" },
              ...categories.map((category) => ({
                label: category.name,
                value: category.id,
              })),
            ]}
            value={draft.categoryId}
          />
        );
      case "transactionDate":
        return (
          <input
            {...shared}
            onChange={(event) => set(field, event.target.value)}
            type="date"
            value={draft.transactionDate}
          />
        );
      case "currency": {
        /* A code the document arrived with (say "NIS") stays choosable. */
        const codes = currencyOptions.includes(draft.currency)
          ? currencyOptions
          : [draft.currency, ...currencyOptions];
        return (
          <FormSelect
            {...select}
            onChange={(value) => set(field, value)}
            options={codes.map((code) => ({
              label: code === "" ? "Not set" : code,
              value: code,
            }))}
            value={draft.currency}
          />
        );
      }
      case "subtotal":
      case "vat":
      case "total":
        return (
          <span className="money-field">
            <span aria-hidden="true" className="money-field__unit">
              {currency ? currencySymbol(currency) : "¤"}
            </span>
            <input
              {...shared}
              className="form-control num"
              inputMode="decimal"
              onChange={(event) => set(field, event.target.value)}
              placeholder="0.00"
              value={draft[field]}
            />
          </span>
        );
      case "businessUsePercentage":
        return (
          <span className="money-field money-field--suffix">
            <input
              {...shared}
              className="form-control num"
              inputMode="decimal"
              max="100"
              min="0"
              onChange={(event) => set(field, event.target.value)}
              step="0.01"
              type="number"
              value={draft.businessUsePercentage}
            />
            <span aria-hidden="true" className="money-field__unit">
              %
            </span>
          </span>
        );
      case "notes":
        return (
          <textarea
            {...shared}
            onChange={(event) => set(field, event.target.value)}
            rows={3}
            value={draft.notes}
          />
        );
      default:
        return (
          <input
            {...shared}
            onChange={(event) => set(field, event.target.value)}
            value={draft[field]}
          />
        );
    }
  }

  const flaggedCount = fields.filter((field) => flagged[field]).length;

  return (
    <section
      aria-labelledby="details-title"
      className="detail-card details"
      data-mode={editing ? "edit" : "read"}
    >
      <header className="detail-card__header">
        <div>
          <h2 className="detail-card__title" id="details-title">
            Details
          </h2>
          <p className="detail-card__note">
            {flaggedCount > 0
              ? `${flaggedCount} ${flaggedCount === 1 ? "field needs" : "fields need"} a look. Correct anything that reads wrong.`
              : "What was read from the document. Correct anything that reads wrong."}
          </p>
        </div>
        {!editing ? (
          <button
            className="button button--secondary button--small details-edit"
            onClick={() => setEditing(true)}
            type="button"
          >
            <Pencil aria-hidden size={12} strokeWidth={2} />
            Edit
          </button>
        ) : null}
      </header>

      {/* Read mode: a phone's first view of the fields. */}
      <div className="details-read">
        {groups.map((group) => (
          <div className="details-group" key={group.label}>
            <span className="lbl details-group__label">{group.label}</span>
            {group.fields.map((field) => {
              const value = readValue(field);
              const money = moneyFields.includes(field);
              return (
                <button
                  className={`fact-row${flagged[field] ? " fact-row--flagged" : ""}`}
                  key={field}
                  onClick={() => {
                    setFocusField(field);
                    setEditing(true);
                  }}
                  type="button"
                >
                  <span className="fact-row__label">{label(field)}</span>
                  <span
                    className={`fact-row__value${money ? " num" : ""}${value.empty ? " is-empty" : ""}`}
                  >
                    {value.text}
                    {field === "vat" && rate ? (
                      <span className="fact-row__aside"> · {rate}</span>
                    ) : null}
                  </span>
                  {flagged[field] ? (
                    <span className="fact-row__flag">{flagged[field]}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Edit mode, and the whole story on desktop. */}
      <form action={formAction} className="details-form" noValidate>
        {/* A div, not a fieldset: a legend inside a grid fieldset is drawn
            into the box's top edge and clipped, and the visible label is
            what a group needs. */}
        {groups.map((group) => (
          <div
            aria-labelledby={`group-${group.label}`}
            className="details-group details-fieldset"
            key={group.label}
            role="group"
          >
            <span
              className="lbl details-group__label"
              id={`group-${group.label}`}
            >
              {group.label}
            </span>
            {group.fields.map((field) => (
              <div
                className={`field details-field details-field--${field}`}
                key={field}
              >
                <label htmlFor={field} id={`${field}-label`}>
                  {label(field)}
                </label>
                {control(field)}
                {note(field)}
              </div>
            ))}
            {group.label === "Amounts" && reconcile ? (
              <p
                className={`details-reconcile details-reconcile--${reconcile.ok ? "ok" : "off"}`}
              >
                {reconcile.ok ? (
                  <Check aria-hidden size={12} strokeWidth={2.4} />
                ) : null}
                {reconcile.text}
                {rate ? ` VAT is ${rate} of the subtotal.` : ""}
              </p>
            ) : null}
          </div>
        ))}

        <div className="details-bar">
          <p
            aria-live="polite"
            className={`details-bar__status${state.error ? " is-error" : ""}`}
            role="status"
          >
            {state.error ? (
              state.error
            ) : dirty ? (
              "Unsaved changes"
            ) : state.saved > 0 ? (
              <>
                <Check aria-hidden size={12} strokeWidth={2.4} />
                Saved
              </>
            ) : null}
          </p>
          <button
            className="button button--ghost details-bar__cancel"
            onClick={discard}
            type="button"
          >
            Cancel
          </button>
          {dirty ? (
            <button
              className="button button--ghost details-bar__discard"
              disabled={pending}
              onClick={discard}
              type="button"
            >
              Discard
            </button>
          ) : null}
          <button
            className="button button--primary"
            disabled={pending || !dirty}
            type="submit"
          >
            {pending ? (
              <LoaderCircle
                aria-hidden
                className="button__spinner"
                size={14}
                strokeWidth={2}
              />
            ) : null}
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </section>
  );
}
