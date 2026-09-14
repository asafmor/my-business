import { expect, test } from "@playwright/test";

import { signIn } from "./support/auth";

test.describe("login", () => {
  test("rejects an incorrect password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // The route announcer Next.js renders on navigation is also role="alert";
    // scope to the login form's own message.
    await expect(page.getByText("Invalid login.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("accepts the real Development password", async ({ page }) => {
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(
      !password,
      "Set E2E_LOGIN_PASSWORD (the plaintext behind AUTH_PASSWORD_HASH) to exercise the real login form.",
    );

    await page.goto("/login");
    await page.getByLabel("Password").fill(password as string);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/");
  });
});

test.describe("session expiry", () => {
  test("redirects an unauthenticated visit to a protected page to login", async ({ page }) => {
    await page.goto("/documents");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("redirects once the session cookie is expired", async ({ page, context, baseURL }) => {
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

    // The app shell's header and the settings page each render their own
    // "Log out" button; either ends the session, so scope to one.
    await page.getByRole("banner").getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/documents");
    await expect(page).toHaveURL(/\/login$/);
  });
});
