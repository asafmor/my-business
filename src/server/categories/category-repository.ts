import "server-only";

import { asc, eq, inArray, sql } from "drizzle-orm";

import type { ExpenseCategory } from "../../domain/categories/types";
import type { CategoryInput } from "../../domain/validation";
import { getDatabase } from "../db/client";
import { categories } from "../db/schema";

export type CategoryWriteResult =
  | { ok: true; category: ExpenseCategory }
  | { ok: false; reason: "DUPLICATE_NAME" | "NOT_FOUND" };

export type CategoryDeleteResult = "DELETED" | "IN_USE" | "NOT_FOUND";

export interface CategoryRepository {
  list(): Promise<ExpenseCategory[]>;
  create(input: CategoryInput): Promise<CategoryWriteResult>;
  update(id: string, input: CategoryInput): Promise<CategoryWriteResult>;
  setActive(ids: readonly string[], active: boolean): Promise<number>;
  reorder(ids: readonly string[]): Promise<void>;
  remove(ids: readonly string[]): Promise<CategoryDeleteResult>;
}

function isPostgresError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

export class DrizzleCategoryRepository implements CategoryRepository {
  constructor(private readonly database: typeof getDatabase = getDatabase) {}

  async list(): Promise<ExpenseCategory[]> {
    return this.database()
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name));
  }

  async create(input: CategoryInput): Promise<CategoryWriteResult> {
    try {
      const [maxRow] = await this.database()
        .select({
          max: sql<number>`coalesce(max(${categories.sortOrder}), -1)`,
        })
        .from(categories);
      const [created] = await this.database()
        .insert(categories)
        .values({ ...input, sortOrder: (maxRow?.max ?? -1) + 1 })
        .returning();
      return { category: created, ok: true };
    } catch (error) {
      if (isPostgresError(error, "23505")) {
        return { ok: false, reason: "DUPLICATE_NAME" };
      }
      throw error;
    }
  }

  async update(id: string, input: CategoryInput): Promise<CategoryWriteResult> {
    try {
      const [updated] = await this.database()
        .update(categories)
        .set(input)
        .where(eq(categories.id, id))
        .returning();
      if (!updated) return { ok: false, reason: "NOT_FOUND" };
      return { category: updated, ok: true };
    } catch (error) {
      if (isPostgresError(error, "23505")) {
        return { ok: false, reason: "DUPLICATE_NAME" };
      }
      throw error;
    }
  }

  async setActive(ids: readonly string[], active: boolean): Promise<number> {
    if (ids.length === 0) return 0;
    const updated = await this.database()
      .update(categories)
      .set({ active })
      .where(inArray(categories.id, [...ids]))
      .returning({ id: categories.id });
    return updated.length;
  }

  /** Drag-and-drop hands back the whole order, so sortOrder is simply the
   * new index. Ids the caller does not know about keep their place after. */
  async reorder(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.database().transaction(async (transaction) => {
      for (const [index, id] of ids.entries()) {
        await transaction
          .update(categories)
          .set({ sortOrder: index })
          .where(eq(categories.id, id));
      }
    });
  }

  /** The category_id FK on expenses is onDelete: restrict, so a category
   * referenced by any expense cannot be hard-deleted — deactivate it
   * instead. This surfaces that as a result rather than a thrown 500.
   * Deleting the batch in one statement would fail whole on a single
   * referenced row, so each is attempted on its own. */
  async remove(ids: readonly string[]): Promise<CategoryDeleteResult> {
    let anyDeleted = false;
    let anyInUse = false;
    for (const id of ids) {
      try {
        const [deleted] = await this.database()
          .delete(categories)
          .where(eq(categories.id, id))
          .returning({ id: categories.id });
        anyDeleted ||= deleted !== undefined;
      } catch (error) {
        if (!isPostgresError(error, "23503")) throw error;
        anyInUse = true;
      }
    }
    if (anyInUse) return "IN_USE";
    return anyDeleted ? "DELETED" : "NOT_FOUND";
  }
}
