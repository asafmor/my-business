"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { categoryInputSchema } from "../../../domain/validation";
import { DrizzleCategoryRepository } from "../../../server/categories/category-repository";
import { requireSession } from "../../../server/auth/service";

const repository = new DrizzleCategoryRepository();

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function redirectWithError(error: string): never {
  redirect(`/categories?error=${encodeURIComponent(error)}`);
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  await requireSession();
  const parsed = categoryInputSchema.safeParse({
    description: emptyToNull(formData.get("description")),
    name: formData.get("name"),
  });
  if (!parsed.success)
    redirectWithError("Please provide a valid category name.");

  const result = await repository.create(parsed.data);
  if (!result.ok)
    redirectWithError("A category with that name already exists.");

  revalidatePath("/categories");
  redirect("/categories");
}

export async function updateCategoryAction(
  id: string,
  formData: FormData,
): Promise<void> {
  await requireSession();
  const parsed = categoryInputSchema.safeParse({
    description: emptyToNull(formData.get("description")),
    name: formData.get("name"),
  });
  if (!parsed.success)
    redirectWithError("Please provide a valid category name.");

  const result = await repository.update(id, parsed.data);
  if (!result.ok)
    redirectWithError("A category with that name already exists.");

  revalidatePath("/categories");
  redirect("/categories");
}

export async function setCategoryActiveAction(
  id: string,
  active: boolean,
): Promise<void> {
  await requireSession();
  await repository.setActive(id, active);
  revalidatePath("/categories");
  redirect("/categories");
}

export async function moveCategoryAction(
  id: string,
  direction: "up" | "down",
): Promise<void> {
  await requireSession();
  await repository.move(id, direction);
  revalidatePath("/categories");
  redirect("/categories");
}

export async function deleteCategoryAction(id: string): Promise<void> {
  await requireSession();
  const result = await repository.remove(id);
  if (result === "IN_USE") {
    redirectWithError(
      "This category is used by existing expenses and can't be deleted. Deactivate it instead.",
    );
  }
  revalidatePath("/categories");
  redirect("/categories");
}
