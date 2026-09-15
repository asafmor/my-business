import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Match the "@/*" -> "src/*" alias tsconfig gives the app.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // e2e/ holds Playwright specs (run via `npm run test:e2e`), not vitest.
    exclude: ["**/node_modules/**", "e2e/**"],
  },
});
