import { expect, test } from "@playwright/test";

import { signIn } from "./support/auth";

test.describe("login", () => {
  test("rejects an incorrect password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("סיסמה").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "התחברות" }).click();

    // The route announcer Next.js renders on navigation is also role="alert";
    // scope to the login form's own message.
    await expect(page.getByText("פרטי ההתחברות שגויים.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("accepts the real Development password", async ({ page }) => {
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(
      !password,
      "Set E2E_LOGIN_PASSWORD (the plaintext behind AUTH_PASSWORD_HASH) to exercise the real login form.",
    );

    await page.goto("/login");
    await page.getByLabel("סיסמה").fill(password as string);
    await page.getByRole("button", { name: "התחברות" }).click();

    await expect(page).toHaveURL("/");
  });
});

test.describe("session expiry", () => {
  test("redirects an unauthenticated visit to a protected page to login", async ({
    page,
  }) => {
    await page.goto("/documents");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("redirects once the session cookie is expired", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL as string, { expired: true });
    await page.goto("/documents");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("logout", () => {
  test("ends the session and returns to login on the next protected visit", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL as string);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings$/);

    // Log out lives in the shell's account card: in the sidebar on wide
    // viewports, behind the navigation drawer on narrow ones. The settings
    // page renders its own button too, so scope to the shell's.
    const menuButton = page.getByRole("button", { name: "פתיחת הניווט" });

    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "התנתקות" })
        .click();
    } else {
      await page
        .getByRole("complementary", { name: "ניווט היישום" })
        .getByRole("button", { name: "התנתקות" })
        .click();
    }
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/documents");
    await expect(page).toHaveURL(/\/login$/);
  });
});
