import "server-only";

import { asc, eq, sql } from "drizzle-orm";

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
  setActive(id: string, active: boolean): Promise<boolean>;
  move(id: string, direction: "up" | "down"): Promise<boolean>;
  remove(id: string): Promise<CategoryDeleteResult>;
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

  async setActive(id: string, active: boolean): Promise<boolean> {
    const [updated] = await this.database()
      .update(categories)
      .set({ active })
      .where(eq(categories.id, id))
      .returning({ id: categories.id });
    return updated !== undefined;
  }

  /** Swaps sortOrder with the adjacent category in display order. */
  async move(id: string, direction: "up" | "down"): Promise<boolean> {
    return this.database().transaction(async (transaction) => {
      const rows = await transaction
        .select({ id: categories.id, sortOrder: categories.sortOrder })
        .from(categories)
        .orderBy(asc(categories.sortOrder), asc(categories.name))
        .for("update");
      const index = rows.findIndex((row) => row.id === id);
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || swapIndex < 0 || swapIndex >= rows.length) return false;

      const current = rows[index]!;
      const swap = rows[swapIndex]!;
      await transaction
        .update(categories)
        .set({ sortOrder: swap.sortOrder })
        .where(eq(categories.id, current.id));
      await transaction
        .update(categories)
        .set({ sortOrder: current.sortOrder })
        .where(eq(categories.id, swap.id));
      return true;
    });
  }

  /** The category_id FK on expenses is onDelete: restrict, so a category
   * referenced by any expense cannot be hard-deleted — deactivate it
   * instead. This surfaces that as a result rather than a thrown 500. */
  async remove(id: string): Promise<CategoryDeleteResult> {
    try {
      const [deleted] = await this.database()
        .delete(categories)
        .where(eq(categories.id, id))
        .returning({ id: categories.id });
      return deleted ? "DELETED" : "NOT_FOUND";
    } catch (error) {
      if (isPostgresError(error, "23503")) return "IN_USE";
      throw error;
    }
  }
}
