"use client";

import {
  CircleCheck,
  CircleSlash2,
  GripVertical,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  createCategoryAction,
  deleteCategoriesAction,
  reorderCategoriesAction,
  setCategoriesActiveAction,
  updateCategoryAction,
  type CategoryActionResult,
} from "../../app/(protected)/categories/actions";
import type { ExpenseCategory } from "../../domain/categories/types";

function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

function sameOrder(
  a: readonly ExpenseCategory[],
  b: readonly ExpenseCategory[],
) {
  return (
    a.length === b.length && a.every((item, index) => item.id === b[index]?.id)
  );
}

/* Deactivating hides a category; deleting loses it. Both ask first. */
type Pending = {
  ids: readonly string[];
  verb: "deactivate" | "delete";
};

const copy = {
  deactivate: {
    body: "It disappears from category pickers. Documents already filed under it keep it.",
    label: "Deactivate",
  },
  delete: {
    body: "This cannot be undone. Categories in use stay; deactivate those instead.",
    label: "Delete",
  },
} as const;

/* Naming the one category beats "1 item"; a batch gets a count. */
export function confirmTitle(
  pending: Pending | null,
  items: readonly ExpenseCategory[],
): string {
  if (pending === null) return "";
  const { ids, verb } = pending;
  if (ids.length === 1) {
    const only = items.find((item) => item.id === ids[0]);
    return `${copy[verb].label} “${only?.name ?? "this category"}”?`;
  }
  return `${copy[verb].label} ${ids.length} categories?`;
}

export function CategoriesTable({
  categories,
}: {
  categories: readonly ExpenseCategory[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<readonly ExpenseCategory[]>(categories);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ description: "", name: "" });
  const [pending, setPending] = useState<Pending | null>(null);
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const newNameRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (pending === null) confirmRef.current?.close();
    else confirmRef.current?.showModal();
  }, [pending]);

  // The server stays the source of truth; local state only holds the
  // in-flight edit, drag position, and selection.
  useEffect(() => {
    setItems(categories);
    setSelected((current) =>
      current.filter((id) => categories.some((item) => item.id === id)),
    );
  }, [categories]);

  function run(action: () => Promise<CategoryActionResult>): void {
    startTransition(async () => {
      const result = await action();
      setError(result.error);
      router.refresh();
    });
  }

  function patch(id: string, change: Partial<ExpenseCategory>): void {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );
  }

  /* Commits on blur: the field already shows what will be saved. */
  function commit(id: string): void {
    const edited = items.find((item) => item.id === id);
    const original = categories.find((item) => item.id === id);
    if (!edited || !original) return;

    if (edited.name.trim().length === 0) {
      patch(id, { description: original.description, name: original.name });
      return;
    }
    if (
      edited.name === original.name &&
      (edited.description ?? "") === (original.description ?? "")
    ) {
      return;
    }

    run(() => updateCategoryAction(id, edited.name, edited.description ?? ""));
  }

  function commitOrder(next: readonly ExpenseCategory[]): void {
    if (sameOrder(next, categories)) return;
    run(() => reorderCategoriesAction(next.map((item) => item.id)));
  }

  function reorderBy(id: string, offset: number): void {
    const from = items.findIndex((item) => item.id === id);
    const to = from + offset;
    if (from === -1 || to < 0 || to >= items.length) return;
    const next = moveItem(items, from, to);
    setItems(next);
    commitOrder(next);
  }

  function handleGripPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    id: string,
  ): void {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingId(id);
  }

  // Rows are measured rather than assumed uniform: they are 38px on desktop
  // and three stacked lines on a phone.
  function handleGripPointerMove(event: ReactPointerEvent<HTMLElement>): void {
    if (draggingId === null) return;
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-row-id]") ?? [],
    );
    const from = rows.findIndex((row) => row.dataset.rowId === draggingId);
    const to = rows.findIndex((row) => {
      const box = row.getBoundingClientRect();
      return event.clientY >= box.top && event.clientY <= box.bottom;
    });
    if (from === -1 || to === -1 || from === to) return;
    setItems((current) => moveItem(current, from, to));
  }

  function handleGripPointerUp(): void {
    if (draggingId === null) return;
    setDraggingId(null);
    commitOrder(items);
  }

  function handleGripKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    id: string,
  ): void {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    reorderBy(id, event.key === "ArrowUp" ? -1 : 1);
  }

  const allSelected = items.length > 0 && selected.length === items.length;

  return (
    <div className="categories">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div
        aria-busy={isPending}
        className={
          draggingId === null
            ? "category-table"
            : "category-table is-reordering"
        }
        onPointerMove={handleGripPointerMove}
        onPointerUp={handleGripPointerUp}
        ref={listRef}
        role="table"
        aria-label="Expense categories"
      >
        <div className="category-row category-row--head" role="row">
          <span />
          <span className="category-row__select">
            <input
              aria-label="Select all categories"
              checked={allSelected}
              className="checkbox"
              onChange={() =>
                setSelected(allSelected ? [] : items.map((item) => item.id))
              }
              type="checkbox"
            />
          </span>
          <span className="lbl">Category</span>
          <span className="lbl">Description</span>
          <span className="lbl">Status</span>
          <span className="lbl category-row__actions-label">Actions</span>
        </div>

        {items.map((category) => {
          const isSelected = selected.includes(category.id);

          return (
            <div
              className="category-row"
              data-dragging={category.id === draggingId ? "" : undefined}
              data-row-id={category.id}
              data-selected={isSelected ? "" : undefined}
              key={category.id}
              role="row"
            >
              <button
                aria-label={`Reorder ${category.name}. Use the arrow keys, or drag.`}
                className="category-row__grip"
                onKeyDown={(event) => handleGripKeyDown(event, category.id)}
                onPointerDown={(event) =>
                  handleGripPointerDown(event, category.id)
                }
                type="button"
              >
                <GripVertical aria-hidden size={15} strokeWidth={1.8} />
              </button>

              <span className="category-row__select">
                <input
                  aria-label={`Select ${category.name}`}
                  checked={isSelected}
                  className="checkbox"
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, category.id]
                        : current.filter((id) => id !== category.id),
                    )
                  }
                  type="checkbox"
                />
              </span>

              <input
                aria-label={`Name of ${category.name}`}
                className="cell-input cell-input--strong"
                maxLength={120}
                onBlur={() => commit(category.id)}
                onChange={(event) =>
                  patch(category.id, { name: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                value={category.name}
              />

              <input
                aria-label={`Description of ${category.name}`}
                className="cell-input"
                onBlur={() => commit(category.id)}
                onChange={(event) =>
                  patch(category.id, { description: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                placeholder="What belongs here?"
                value={category.description ?? ""}
              />

              <span className="category-row__status">
                <span
                  className={
                    category.active
                      ? "status-badge status-badge--success"
                      : "status-badge status-badge--neutral"
                  }
                >
                  {category.active ? "Active" : "Inactive"}
                </span>
              </span>

              <span className="category-row__actions">
                <button
                  aria-label={
                    category.active
                      ? `Deactivate ${category.name}`
                      : `Activate ${category.name}`
                  }
                  className="row-action"
                  onClick={() =>
                    category.active
                      ? setPending({ ids: [category.id], verb: "deactivate" })
                      : run(() =>
                          setCategoriesActiveAction([category.id], true),
                        )
                  }
                  title={category.active ? "Deactivate" : "Activate"}
                  type="button"
                >
                  {category.active ? (
                    <CircleSlash2 aria-hidden size={15} strokeWidth={1.8} />
                  ) : (
                    <CircleCheck aria-hidden size={15} strokeWidth={1.8} />
                  )}
                </button>
                <button
                  aria-label={`Delete ${category.name}`}
                  className="row-action row-action--danger"
                  onClick={() =>
                    setPending({ ids: [category.id], verb: "delete" })
                  }
                  title="Delete"
                  type="button"
                >
                  <Trash2 aria-hidden size={15} strokeWidth={1.8} />
                </button>
              </span>
            </div>
          );
        })}

        {/* The last row is the way to add one: no separate form above or below. */}
        <form
          className="category-row category-row--new"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.name.trim().length === 0) return;
            const pending = draft;
            setDraft({ description: "", name: "" });
            newNameRef.current?.focus();
            run(() => createCategoryAction(pending.name, pending.description));
          }}
        >
          <span
            aria-hidden="true"
            className="category-row__grip is-placeholder"
          >
            <Plus size={15} strokeWidth={2} />
          </span>
          <span />
          <input
            aria-label="New category name"
            className="cell-input cell-input--strong"
            maxLength={120}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Add a category"
            ref={newNameRef}
            value={draft.name}
          />
          <input
            aria-label="New category description"
            className="cell-input"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="What belongs here?"
            value={draft.description}
          />
          <span />
          <span className="category-row__actions is-persistent">
            <button
              className="button button--secondary button--compact"
              disabled={draft.name.trim().length === 0}
              type="submit"
            >
              <Plus aria-hidden size={14} strokeWidth={2} />
              Add
            </button>
          </span>
        </form>
      </div>

      {selected.length > 0 ? (
        <div className="selection-bar" role="group" aria-label="Bulk actions">
          <span className="selection-bar__count num">
            {selected.length} selected
          </span>
          <span aria-hidden="true" className="selection-bar__divider" />
          <div className="selection-bar__actions">
            <button
              className="selection-bar__action"
              onClick={() =>
                run(() => setCategoriesActiveAction(selected, true))
              }
              type="button"
            >
              <CircleCheck aria-hidden size={14} strokeWidth={1.9} />
              <span>
                Activate<span className="selection-bar__scope"> selected</span>
              </span>
            </button>
            <button
              className="selection-bar__action"
              onClick={() => setPending({ ids: selected, verb: "deactivate" })}
              type="button"
            >
              <CircleSlash2 aria-hidden size={14} strokeWidth={1.9} />
              <span>
                Deactivate
                <span className="selection-bar__scope"> selected</span>
              </span>
            </button>
            <button
              className="selection-bar__action selection-bar__action--danger"
              onClick={() => setPending({ ids: selected, verb: "delete" })}
              type="button"
            >
              <Trash2 aria-hidden size={14} strokeWidth={1.9} />
              <span>
                Delete<span className="selection-bar__scope"> selected</span>
              </span>
            </button>
          </div>
          <button
            aria-label="Clear selection"
            className="selection-bar__dismiss"
            onClick={() => setSelected([])}
            type="button"
          >
            <X aria-hidden size={13} strokeWidth={2.4} />
          </button>
        </div>
      ) : null}

      <dialog
        aria-labelledby="categories-dialog-title"
        className="confirm-dialog"
        onCancel={() => setPending(null)}
        onClose={() => setPending(null)}
        ref={confirmRef}
      >
        <h2 id="categories-dialog-title">{confirmTitle(pending, items)}</h2>
        <p>{pending ? copy[pending.verb].body : null}</p>
        <div className="confirm-dialog__actions">
          <button
            className="button button--secondary"
            onClick={() => setPending(null)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="button button--danger"
            onClick={() => {
              if (pending === null) return;
              const { ids, verb } = pending;
              setPending(null);
              setSelected([]);
              run(() =>
                verb === "delete"
                  ? deleteCategoriesAction(ids)
                  : setCategoriesActiveAction(ids, false),
              );
            }}
            type="button"
          >
            {pending?.verb === "deactivate" ? (
              <CircleSlash2 aria-hidden size={14} strokeWidth={2} />
            ) : (
              <Trash2 aria-hidden size={14} strokeWidth={2} />
            )}
            {pending ? copy[pending.verb].label : "Delete"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
