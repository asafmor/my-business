"use client";

import { useActionState } from "react";

import type { DocumentEditFormState } from "../../app/(protected)/documents/[id]/actions";
import type { InboxRow } from "../../server/documents/inbox-query-repository";

const initialState: DocumentEditFormState = { error: null, fieldErrors: {} };

/**
 * Compact inline edit for the Inbox: only the highest-value fields are
 * shown, but it submits to the same saveDocumentEditAction/saveEdit the
 * full document-detail form uses. Fields not shown here are carried as
 * hidden inputs defaulted to their current value, so the shared diff logic
 * (diffExpenseEdit) sees no change for anything the user didn't touch.
 */
export function InboxInlineEditForm({
  action,
  categories,
  row,
}: {
  action: (
    state: DocumentEditFormState,
    formData: FormData,
  ) => Promise<DocumentEditFormState>;
  categories: { id: string; name: string }[];
  row: InboxRow;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <details className="inbox-inline-edit">
      <summary>Edit</summary>
      <form action={formAction} className="inbox-inline-edit__form">
        {state.error && <p className="form-error">{state.error}</p>}

        <input defaultValue={row.documentType} name="documentType" type="hidden" />
        <input defaultValue={row.currency ?? ""} name="currency" type="hidden" />
        <input defaultValue={row.subtotal ?? ""} name="subtotal" type="hidden" />
        <input defaultValue={row.vat ?? ""} name="vat" type="hidden" />
        <input
          defaultValue={row.businessUsePercentage}
          name="businessUsePercentage"
          type="hidden"
        />
        <input
          defaultValue={row.documentNumber ?? ""}
          name="documentNumber"
          type="hidden"
        />
        <input
          defaultValue={row.paymentMethod ?? ""}
          name="paymentMethod"
          type="hidden"
        />
        <input defaultValue={row.notes ?? ""} name="notes" type="hidden" />

        <div className="field">
          <label htmlFor={`supplierName-${row.id}`}>Supplier</label>
          <input
            className="form-control"
            defaultValue={row.supplierName ?? ""}
            id={`supplierName-${row.id}`}
            name="supplierName"
          />
          {state.fieldErrors.supplierName && (
            <p className="form-control__error">{state.fieldErrors.supplierName}</p>
          )}
        </div>

        <div className="field">
          <label htmlFor={`transactionDate-${row.id}`}>Date</label>
          <input
            className="form-control"
            defaultValue={row.transactionDate ?? ""}
            id={`transactionDate-${row.id}`}
            name="transactionDate"
            type="date"
          />
          {state.fieldErrors.transactionDate && (
            <p className="form-control__error">{state.fieldErrors.transactionDate}</p>
          )}
        </div>

        <div className="field">
          <label htmlFor={`total-${row.id}`}>Total</label>
          <input
            className="form-control"
            defaultValue={row.total ?? ""}
            id={`total-${row.id}`}
            name="total"
            placeholder="0.00"
          />
          {state.fieldErrors.total && (
            <p className="form-control__error">{state.fieldErrors.total}</p>
          )}
        </div>

        <div className="field">
          <label htmlFor={`categoryId-${row.id}`}>Category</label>
          <select
            className="form-control"
            defaultValue={row.categoryId ?? ""}
            id={`categoryId-${row.id}`}
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

        <button className="button button--primary" disabled={pending} type="submit">
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
    </details>
  );
}
