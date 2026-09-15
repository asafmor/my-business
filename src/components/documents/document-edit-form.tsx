"use client";

import { useActionState } from "react";

import { documentTypes } from "../../domain/documents/types";
import { humanizeEnumValue } from "../../lib/format";
import type { DocumentEditFormState } from "../../app/(protected)/documents/[id]/actions";

const initialState: DocumentEditFormState = { error: null, fieldErrors: {} };

export function DocumentEditForm({
  action,
  categories,
  manualFields,
  values,
}: {
  action: (
    state: DocumentEditFormState,
    formData: FormData,
  ) => Promise<DocumentEditFormState>;
  categories: { id: string; name: string }[];
  manualFields: Set<string>;
  values: {
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
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  function label(field: string, text: string) {
    return manualFields.has(field) ? `${text} (manually corrected)` : text;
  }

  return (
    <form action={formAction} className="document-edit-form">
      {state.error && <p className="form-error">{state.error}</p>}

      <div className="field">
        <label htmlFor="supplierName">
          {label("supplierName", "Supplier")}
        </label>
        <input
          className="form-control"
          defaultValue={values.supplierName ?? ""}
          id="supplierName"
          name="supplierName"
        />
        {state.fieldErrors.supplierName && (
          <p className="form-control__error">
            {state.fieldErrors.supplierName}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="documentType">Document type</label>
        <select
          className="form-control"
          defaultValue={values.documentType}
          id="documentType"
          name="documentType"
        >
          {documentTypes.map((type) => (
            <option key={type} value={type}>
              {humanizeEnumValue(type)}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="documentNumber">
          {label("documentNumber", "Document number")}
        </label>
        <input
          className="form-control"
          defaultValue={values.documentNumber ?? ""}
          id="documentNumber"
          name="documentNumber"
        />
        {state.fieldErrors.documentNumber && (
          <p className="form-control__error">
            {state.fieldErrors.documentNumber}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="transactionDate">
          {label("transactionDate", "Transaction date")}
        </label>
        <input
          className="form-control"
          defaultValue={values.transactionDate ?? ""}
          id="transactionDate"
          name="transactionDate"
          type="date"
        />
        {state.fieldErrors.transactionDate && (
          <p className="form-control__error">
            {state.fieldErrors.transactionDate}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="currency">{label("currency", "Currency")}</label>
        <input
          className="form-control"
          defaultValue={values.currency ?? ""}
          id="currency"
          maxLength={3}
          name="currency"
          placeholder="ILS"
          style={{ textTransform: "uppercase" }}
        />
        {state.fieldErrors.currency && (
          <p className="form-control__error">{state.fieldErrors.currency}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor="subtotal">{label("subtotal", "Subtotal")}</label>
        <input
          className="form-control"
          defaultValue={values.subtotal ?? ""}
          id="subtotal"
          name="subtotal"
          placeholder="0.00"
        />
        {state.fieldErrors.subtotal && (
          <p className="form-control__error">{state.fieldErrors.subtotal}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor="total">{label("total", "Total")}</label>
        <input
          className="form-control"
          defaultValue={values.total ?? ""}
          id="total"
          name="total"
          placeholder="0.00"
        />
        {state.fieldErrors.total && (
          <p className="form-control__error">{state.fieldErrors.total}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor="vat">{label("vat", "VAT")}</label>
        <input
          className="form-control"
          defaultValue={values.vat ?? ""}
          id="vat"
          name="vat"
          placeholder="0.00"
        />
        {state.fieldErrors.vat && (
          <p className="form-control__error">{state.fieldErrors.vat}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor="categoryId">{label("category", "Category")}</label>
        <select
          className="form-control"
          defaultValue={values.categoryId ?? ""}
          id="categoryId"
          name="categoryId"
        >
          <option value="">Uncategorized</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="businessUsePercentage">
          {label("businessUsePercentage", "Business use %")}
        </label>
        <input
          className="form-control"
          defaultValue={values.businessUsePercentage}
          id="businessUsePercentage"
          max="100"
          min="0"
          name="businessUsePercentage"
          step="0.01"
          type="number"
        />
        {state.fieldErrors.businessUsePercentage && (
          <p className="form-control__error">
            {state.fieldErrors.businessUsePercentage}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="paymentMethod">
          {label("paymentMethod", "Payment method")}
        </label>
        <input
          className="form-control"
          defaultValue={values.paymentMethod ?? ""}
          id="paymentMethod"
          name="paymentMethod"
        />
        {state.fieldErrors.paymentMethod && (
          <p className="form-control__error">
            {state.fieldErrors.paymentMethod}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="notes">{label("notes", "Notes")}</label>
        <textarea
          className="form-control"
          defaultValue={values.notes ?? ""}
          id="notes"
          name="notes"
          rows={3}
        />
      </div>

      <button
        className="button button--primary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
