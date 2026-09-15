"use server";

import { revalidatePath } from "next/cache";

import { categoryInputSchema } from "../../../domain/validation";
import { DrizzleCategoryRepository } from "../../../server/categories/category-repository";
import { requireSession } from "../../../server/auth/service";

const repository = new DrizzleCategoryRepository();

/* The table edits in place, so an action answers rather than redirects. */
export type CategoryActionResult = { error: string } | { error: null };

const ok: CategoryActionResult = { error: null };

function parse(name: string, description: string) {
  const trimmed = description.trim();
  return categoryInputSchema.safeParse({
    description: trimmed.length > 0 ? trimmed : null,
    name,
  });
}

function done(): CategoryActionResult {
  revalidatePath("/categories");
  return ok;
}

export async function createCategoryAction(
  name: string,
  description: string,
): Promise<CategoryActionResult> {
  await requireSession();
  const parsed = parse(name, description);
  if (!parsed.success)
    return { error: "Please provide a valid category name." };

  const result = await repository.create(parsed.data);
  if (!result.ok) return { error: "A category with that name already exists." };

  return done();
}

export async function updateCategoryAction(
  id: string,
  name: string,
  description: string,
): Promise<CategoryActionResult> {
  await requireSession();
  const parsed = parse(name, description);
  if (!parsed.success)
    return { error: "Please provide a valid category name." };

  const result = await repository.update(id, parsed.data);
  if (!result.ok)
    return {
      error:
        result.reason === "DUPLICATE_NAME"
          ? "A category with that name already exists."
          : "That category no longer exists.",
    };

  return done();
}

export async function setCategoriesActiveAction(
  ids: readonly string[],
  active: boolean,
): Promise<CategoryActionResult> {
  await requireSession();
  await repository.setActive(ids, active);
  return done();
}

export async function reorderCategoriesAction(
  ids: readonly string[],
): Promise<CategoryActionResult> {
  await requireSession();
  await repository.reorder(ids);
  return done();
}

export async function deleteCategoriesAction(
  ids: readonly string[],
): Promise<CategoryActionResult> {
  await requireSession();
  const result = await repository.remove(ids);
  revalidatePath("/categories");

  if (result === "IN_USE") {
    return {
      error:
        "Categories already used by expenses can't be deleted. Deactivate them instead.",
    };
  }

  return ok;
}
