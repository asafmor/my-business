import { expect, test } from "@playwright/test";

import { signIn } from "./support/auth";

// Minimal-but-valid PDF bytes; content doesn't matter (no AI call in this
// suite - see CONTRIBUTING.md), only that file-validation.ts accepts
// it. A random comment keeps the sha256 unique per run so upload's
// duplicate-detection doesn't flag a rerun against the same document.
const minimalPdf = Buffer.from(
  `%PDF-1.4\n% ${crypto.randomUUID()}\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`,
);

test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL as string);
});

test("a valid file uploads and reaches a processing state", async ({
  page,
}) => {
  await page.goto("/upload");
  await page
    .getByLabel("Drop documents here")
    .locator('input[type="file"]:not([capture])')
    .setInputFiles({
      buffer: minimalPdf,
      mimeType: "application/pdf",
      name: "e2e-receipt.pdf",
    });
  await page.getByRole("button", { name: "Upload selected" }).click();

  const card = page.locator(".upload-card", { hasText: "e2e-receipt.pdf" });
  await expect(card).toContainText(/Processing|Needs review|Uploaded/, {
    timeout: 15_000,
  });
});

test("an unsupported file is rejected with a clear message", async ({
  page,
}) => {
  await page.goto("/upload");
  await page
    .getByLabel("Drop documents here")
    .locator('input[type="file"]:not([capture])')
    .setInputFiles({
      buffer: Buffer.from("just some text, not a document"),
      mimeType: "text/plain",
      name: "e2e-notes.txt",
    });
  await page.getByRole("button", { name: "Upload selected" }).click();

  const card = page.locator(".upload-card", { hasText: "e2e-notes.txt" });
  await expect(card).toContainText("Not accepted");
  await expect(card).toContainText("File type is not supported.");
});
