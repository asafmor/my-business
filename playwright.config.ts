import { defineConfig, devices } from "@playwright/test";

// npm run test:e2e loads Development credentials the same way npm run
// db:migrate / cloud:check:* do, so a plain `npx playwright test` outside
// this script still picks up .env.local when it's present.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (e.g. Development credentials not pulled yet). The
  // global setup below fails fast with a clear message instead of hanging.
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  // All specs share one real Development DB/dev server (no per-test
  // isolation), so run serially - parallel workers raced background
  // processing dispatch and each other's seeded data.
  fullyParallel: false,
  globalSetup: "./e2e/support/global-setup.ts",
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "tablet",
      use: { ...devices["iPad (gen 7)"] },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"] },
    },
  ],
  reporter: [["list"]],
  retries: 0,
  testDir: "./e2e",
  // Same reason as fullyParallel above: one real shared backend, so also
  // serialize across the desktop/tablet/mobile projects, not just files.
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  // Reuses an already-running `npm run dev` if there is one; otherwise
  // starts one against the same Development credentials. Never starts a
  // production build.
  webServer: {
    command: "npm run dev",
    reuseExistingServer: true,
    timeout: 60_000,
    url: baseURL,
  },
});
