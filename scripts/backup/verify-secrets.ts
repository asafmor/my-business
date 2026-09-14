// Confirms the GitHub Actions secrets that backup workflows depend on are
// present, without ever printing their values. See docs/CLOUD_FOUNDATION.md
// "GitHub Actions secrets".

const requiredBackupVariables = [
  "NEON_BACKUP_DATABASE_URL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "B2_ENDPOINT",
  "B2_REGION",
  "B2_ACCESS_KEY_ID",
  "B2_SECRET_ACCESS_KEY",
  "B2_BUCKET",
] as const;

const missingVariables = requiredBackupVariables.filter(
  (name) => !process.env[name],
);

if (missingVariables.length > 0) {
  throw new Error(
    `Missing backup variables: ${missingVariables.join(", ")}.`,
  );
}

console.log("Backup secrets present.");
