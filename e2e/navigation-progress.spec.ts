import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./support/auth";
import { deleteSeededDocument, seedReviewableDocument } from "./support/db";
import type { SeededDocument } from "./support/db";

let seeded: SeededDocument;

test.beforeEach(async ({ context, baseURL }) => {
  seeded = await seedReviewableDocument({ status: "READY" });
  await signIn(context, baseURL as string);
});

test.afterEach(async () => {
  await deleteSeededDocument(seeded.id);
});

/*
 * The indicator is raised on the intent to navigate and lowered on arrival, so
 * an intent that never arrives leaves it spinning over a settled page until the
 * next navigation. Both cases below used to do exactly that, and both only show
 * it after the route has stopped moving - hence the settle wait before looking.
 */
async function expectNoIndicator(page: Page): Promise<void> {
  await page.waitForTimeout(500);
  await expect(page.locator(".navigation-progress")).toHaveCount(0);
}

test("navigation-progress: going back does not leave the indicator up", async ({
  page,
}) => {
  await page.goto("/documents");
  await page.getByRole("link", { name: seeded.supplierName }).click();
  await expect(page).toHaveURL(new RegExp(`/documents/${seeded.id}`));

  await page.goBack();
  await expect(page).toHaveURL(/\/documents$/);
  await expectNoIndicator(page);
});

test("navigation-progress: selecting a row does not leave the indicator up", async ({
  page,
}) => {
  await page.goto(`/documents?q=${encodeURIComponent(seeded.supplierName)}`);

  // The first tick comes from the box; from then on the whole row is a tick
  // box, and its link cancels the navigation it looks like it will make.
  await page
    .getByRole("checkbox", { name: `Select ${seeded.supplierName}` })
    .check();
  await page.getByRole("link", { name: seeded.supplierName }).click();

  await expect(page).toHaveURL(/\/documents\?q=/);
  await expectNoIndicator(page);
});
