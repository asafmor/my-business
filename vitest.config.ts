import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // e2e/ holds Playwright specs (run via `npm run test:e2e`), not vitest.
    exclude: ["**/node_modules/**", "e2e/**"],
  },
});
