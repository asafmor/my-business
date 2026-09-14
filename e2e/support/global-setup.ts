import { assertCloudEnvironment } from "../../src/server/config/cloud-environment";

/**
 * Fails fast with a clear message instead of letting the suite hang or fail
 * with an opaque connection error, mirroring the guard style already used
 * by scripts/db/check-consistency.ts and scripts/cloud/verify-environment.ts.
 *
 * This suite needs a running dev server plus real Development credentials
 * (DATABASE_URL, R2_*, AUTH_SESSION_SECRET, AUTH_PASSWORD_HASH, OPENAI_API_KEY)
 * and is intentionally NOT run in CI - see CONTRIBUTING.md.
 */
export default function globalSetup(): void {
  try {
    assertCloudEnvironment(process.env);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `e2e tests require Development credentials in .env.local (run "vercel env pull .env.local"). ${reason}`,
      { cause: error },
    );
  }
}
