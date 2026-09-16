import { expect, test } from "@playwright/test";

import { signIn } from "./support/auth";

test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL as string);
});

// 23.6: structural/visibility smoke check across desktop/tablet/mobile
// viewports (see playwright.config.ts projects). No screenshot diffing -
// out of scope per CONTRIBUTING.md.
async function checkNoOverflowAndReachableNav(
  page: import("@playwright/test").Page,
  path: string,
) {
  await page.goto(path);

  const viewport = page.viewportSize();
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);

  const menuButton = page.getByRole("button", { name: "Open navigation" });
  const sidebarNav = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  // Wide viewports show the persistent sidebar; narrow ones collapse it
  // behind the menu button - either is an acceptable "reachable" state.
  await expect(menuButton.or(sidebarNav)).toBeVisible();
}

for (const path of ["/", "/documents", "/reports"]) {
  test(`${path} has no horizontal overflow and its navigation is reachable`, async ({
    page,
  }) => {
    await checkNoOverflowAndReachableNav(page, path);
  });
}

test("the upload tray opens on mobile without causing horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Upload tray/ }).click();
  await expect(page.getByRole("region", { name: "Upload tray" })).toBeVisible();

  const viewport = page.viewportSize();
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
});

// The select cell claims the gutter either side of its checkbox (the row's
// padding and the column gap). Geometry no unit test can see: the row link is
// stretched over the whole row, so a few dead pixels here open the document
// instead of ticking the row.
test("a click in the row's left gutter ticks the row instead of opening it", async ({
  page,
}) => {
  await page.goto("/documents");
  const row = page.locator(".doc-row:not(.doc-row--head)").first();
  if ((await row.count()) === 0) test.skip(true, "no documents to select");
  await row.waitFor();

  const box = (await row.boundingBox())!;
  await page.mouse.click(box.x + 1, box.y + box.height / 2);

  await expect(page.getByRole("group", { name: "Bulk actions" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/documents");
});
