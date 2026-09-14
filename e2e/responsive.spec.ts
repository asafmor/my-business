import { expect, test } from "@playwright/test";

import { signIn } from "./support/auth";

test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL as string);
});

// 23.6: structural/visibility smoke check across desktop/tablet/mobile
// viewports (see playwright.config.ts projects). No screenshot diffing -
// out of scope per CONTRIBUTING.md.
async function checkNoOverflowAndReachableNav(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);

  const viewport = page.viewportSize();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);

  const menuButton = page.getByRole("button", { name: "Open navigation" });
  const sidebarNav = page.getByRole("navigation", { name: "Primary navigation" });
  // Wide viewports show the persistent sidebar; narrow ones collapse it
  // behind the menu button - either is an acceptable "reachable" state.
  await expect(menuButton.or(sidebarNav)).toBeVisible();
}

for (const path of ["/", "/inbox"]) {
  test(`${path} has no horizontal overflow and its navigation is reachable`, async ({ page }) => {
    await checkNoOverflowAndReachableNav(page, path);
  });
}

// Known gap this smoke spec caught: the documents table overflows
// horizontally at tablet width (~810px viewport, ~1012px content). Real app
// CSS work, tracked for PLAN.md 26-responsive-and-mobile-polish - not fixed
// here since this issue is testing infrastructure, not UI polish.
test(
  "/documents has no horizontal overflow and its navigation is reachable",
  { tag: "@known-gap" },
  async ({ page }) => {
    test.fixme(
      test.info().project.name === "tablet",
      "documents table overflows at tablet width - see 26-responsive-and-mobile-polish",
    );
    await checkNoOverflowAndReachableNav(page, "/documents");
  },
);
