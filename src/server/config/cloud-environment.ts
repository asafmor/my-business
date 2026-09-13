type Environment = Record<string, string | undefined>;

const b2RuntimeVariables = [
  "B2_ENDPOINT",
  "B2_ACCESS_KEY_ID",
  "B2_SECRET_ACCESS_KEY",
  "B2_BUCKET",
] as const;

const requiredR2Variables = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

export function assertProductionDeployment(environment: Environment): void {
  if (environment.VERCEL_ENV && environment.VERCEL_ENV !== "production") {
    throw new Error("Cloud resources are disabled outside Vercel Production.");
  }

  if (environment.APP_ENV !== "production") {
    throw new Error(
      "APP_ENV must be production before cloud resources can be used.",
    );
  }
}

export function assertProductionDatabaseEnvironment(
  environment: Environment,
): void {
  assertProductionDeployment(environment);

  if (!environment.DATABASE_URL) {
    throw new Error("Missing application variable: DATABASE_URL.");
  }
}

export function assertProductionR2Environment(environment: Environment): void {
  assertProductionDeployment(environment);

  const missingVariables = requiredR2Variables.filter(
    (name) => !environment[name],
  );
  if (missingVariables.length > 0) {
    throw new Error(`Missing R2 variables: ${missingVariables.join(", ")}.`);
  }

  if (environment.R2_BUCKET !== "rotem") {
    throw new Error("R2_BUCKET must identify the production bucket rotem.");
  }
}

export function assertCloudEnvironment(environment: Environment): void {
  assertProductionDatabaseEnvironment(environment);
  assertProductionR2Environment(environment);

  if (!environment.AUTH_SESSION_SECRET) {
    throw new Error("Missing application variable: AUTH_SESSION_SECRET.");
  }

  const exposedB2Variables = b2RuntimeVariables.filter(
    (name) => environment[name],
  );
  if (exposedB2Variables.length > 0) {
    throw new Error(
      `B2 backup credentials cannot be exposed to the application runtime: ${exposedB2Variables.join(", ")}.`,
    );
  }
}
