import { expect, test } from "@playwright/test";

import { signIn } from "./support/auth";
import { deleteSeededDocument, seedReviewableDocument } from "./support/db";
import type { SeededDocument } from "./support/db";

let seeded: SeededDocument;

// Seeded transactionDate is the 1st of the current month (see support/db.ts)
// so it lands in the report's default month with no date math here.
const currentMonth = new Date().toISOString().slice(0, 7);

test.beforeEach(async ({ context, baseURL }) => {
  seeded = await seedReviewableDocument({ status: "READY" });
  await signIn(context, baseURL as string);
});

test.afterEach(async () => {
  await deleteSeededDocument(seeded.id);
});

test("monthly-report: a READY document's total is reflected in the month's summary", async ({
  page,
}) => {
  await page.goto(`/reports?month=${currentMonth}`);
  await expect(
    page.getByRole("heading", { name: "Reports", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".dashboard-stat__value").first()).not.toHaveText(
    "0",
  );
});

test("export-report: CSV export responds with a CSV file for the month", async ({
  page,
  context,
}) => {
  await page.goto(`/reports?month=${currentMonth}`);
  const csvLink = page.getByRole("link", { name: "Export CSV" });
  const href = await csvLink.getAttribute("href");

  // context.request shares the browser context's cookie jar (the session
  // cookie set by signIn), unlike the standalone `request` fixture.
  const response = await context.request.get(href as string);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("csv");
});

test("export-report: generating a PDF report adds it to the month's report list", async ({
  page,
}) => {
  await page.goto(`/reports?month=${currentMonth}`);
  await page.getByRole("button", { name: "Generate PDF report" }).click();

  await expect(
    page.getByRole("link", { name: "Download" }).first(),
  ).toBeVisible({
    timeout: 15_000,
  });
});
