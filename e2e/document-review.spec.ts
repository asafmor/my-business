import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { signIn } from "./support/auth";
import {
  anyActiveCategory,
  deleteSeededDocument,
  seedReviewableDocument,
} from "./support/db";
import type { SeededDocument } from "./support/db";

let seeded: SeededDocument;

test.beforeEach(async ({ context, baseURL }) => {
  seeded = await seedReviewableDocument();
  await signIn(context, baseURL as string);
});

test.afterEach(async () => {
  await deleteSeededDocument(seeded.id);
});

/* A phone reads the details first and edits on request; desktop shows the
   form outright. Either way, the fields are open once this returns. */
async function startEditing(page: Page): Promise<void> {
  const edit = page.getByRole("button", { exact: true, name: "Edit" });
  if (await edit.isVisible()) await edit.click();
  await expect(page.locator("#supplierName")).toBeVisible();
}

async function save(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Save" }).click();
  // "Saving…" while the server action is pending; the status line settles on
  // "Saved" once the write is through, so a reload cannot race it.
  await expect(
    page.getByRole("status").filter({ hasText: "Saved" }),
  ).toBeVisible();
}

test("review-document: a NEEDS_REVIEW document shows its review banner and can be marked reviewed", async ({
  page,
}) => {
  await page.goto(`/documents/${seeded.id}`);
  await expect(page.getByText("Needs your review")).toBeVisible();

  await page.getByRole("button", { name: "Mark reviewed" }).click();
  await expect(page.getByText("Needs your review")).not.toBeVisible();
  await expect(page.getByText("Marked reviewed")).toBeVisible();
});

test("correct-field: editing a field persists it and marks it edited", async ({
  page,
}) => {
  await page.goto(`/documents/${seeded.id}`);
  await startEditing(page);
  await page.fill("#supplierName", "Corrected Supplier Ltd");
  await save(page);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Corrected Supplier Ltd" }),
  ).toBeVisible();
  await startEditing(page);
  await expect(page.locator("#supplierName")).toHaveValue(
    "Corrected Supplier Ltd",
  );
  await expect(
    page.locator('label[for="supplierName"] .details-edited'),
  ).toBeVisible();
  await expect(page.getByText("Supplier changed")).toBeVisible();
});

test("categorize-expense: assigning a category persists across reload", async ({
  page,
}) => {
  const category = await anyActiveCategory();
  test.skip(
    !category,
    "No active category exists in this Development database to assign.",
  );

  await page.goto(`/documents/${seeded.id}`);
  await startEditing(page);
  // Desktop draws its own menu over a hidden native select; a phone shows
  // the native select itself.
  const trigger = page.locator("#categoryId ~ .form-select__trigger");
  if (await trigger.isVisible()) {
    await trigger.click();
    await page.getByRole("option", { name: category!.name }).click();
  } else {
    await page.selectOption("#categoryId", category!.id);
  }
  await save(page);

  await page.reload();
  await expect(page.getByText(category!.name).first()).toBeVisible();
  await startEditing(page);
  await expect(page.locator("#categoryId")).toHaveValue(category!.id);
});
