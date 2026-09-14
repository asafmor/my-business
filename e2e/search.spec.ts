import { expect, test } from "@playwright/test";

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

test("search-document: finds a document by supplier name and excludes it for an unrelated query", async ({
  page,
}) => {
  await page.goto(`/documents?q=${encodeURIComponent(seeded.supplierName)}`);
  await expect(page.getByRole("link", { name: seeded.supplierName })).toBeVisible();

  await page.goto("/documents?q=no-such-supplier-should-match-nothing");
  await expect(page.getByRole("link", { name: seeded.supplierName })).toHaveCount(0);
});
