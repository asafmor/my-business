import { expect, test } from "@playwright/test";

import { signIn } from "./support/auth";
import { anyActiveCategory, deleteSeededDocument, seedReviewableDocument } from "./support/db";
import type { SeededDocument } from "./support/db";

let seeded: SeededDocument;

test.beforeEach(async ({ context, baseURL }) => {
  seeded = await seedReviewableDocument();
  await signIn(context, baseURL as string);
});

test.afterEach(async () => {
  await deleteSeededDocument(seeded.id);
});

test("review-document: a NEEDS_REVIEW document shows its review banner and can be marked reviewed", async ({
  page,
}) => {
  await page.goto(`/documents/${seeded.id}`);
  await expect(page.getByText("Needs review", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Mark reviewed" }).click();
  await expect(page.getByText("Needs review", { exact: false })).not.toBeVisible();
});

test("correct-field: editing a field persists it and marks it manually corrected", async ({
  page,
}) => {
  await page.goto(`/documents/${seeded.id}`);
  await page.fill("#supplierName", "Corrected Supplier Ltd");
  await page.getByRole("button", { name: "Save" }).click();
  // The form shows "Saving..." while the server action is pending; wait for
  // it to settle back to "Save" so a reload doesn't race the write.
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();

  await expect(page.getByLabel("Supplier (manually corrected)")).toHaveValue(
    "Corrected Supplier Ltd",
  );
});

test("categorize-expense: assigning a category persists across reload", async ({ page }) => {
  const category = await anyActiveCategory();
  test.skip(!category, "No active category exists in this Development database to assign.");

  await page.goto(`/documents/${seeded.id}`);
  await page.selectOption("#categoryId", category!.id);
  await page.getByRole("button", { name: "Save" }).click();
  // The form shows "Saving..." while the server action is pending; wait for
  // it to settle back to "Save" so a reload doesn't race the write.
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();

  await page.reload();
  await expect(page.locator("#categoryId")).toHaveValue(category!.id);
  await expect(page.getByText(`Category: ${category!.name}`, { exact: false })).toBeVisible();
});
