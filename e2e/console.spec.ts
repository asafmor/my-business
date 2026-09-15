import { expect, test } from "@playwright/test";

import { signIn } from "./support/auth";

test("no console errors on a clean browser", async ({
  page,
  context,
  baseURL,
}) => {
  const messages: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      messages.push(`${m.type()}: ${m.text()}`);
    }
  });
  page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));

  await signIn(context, baseURL as string);
  for (const path of ["/", "/reports", "/settings", "/documents", "/inbox"]) {
    await page.goto(path);
    await page.waitForTimeout(900);
  }
  console.log("CONSOLE:", JSON.stringify(messages, null, 2));
  expect(messages).toEqual([]);
});
