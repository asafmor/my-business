import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const worksheetPath = resolve(process.argv[2] ?? ".env.cloud.local");
const setupKeyId = required("B2_SETUP_KEY_ID");
const setupApplicationKey = required("B2_SETUP_APPLICATION_KEY");
const bucketId = required("B2_BUCKET_ID");

const authorizeResponse = await fetch(
  "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
  {
    headers: {
      Authorization: `Basic ${Buffer.from(`${setupKeyId}:${setupApplicationKey}`).toString("base64")}`,
    },
  },
);

if (!authorizeResponse.ok) {
  throw new Error(
    `B2 setup authorization failed with HTTP ${authorizeResponse.status}.`,
  );
}

const authorization = (await authorizeResponse.json()) as {
  accountId: string;
  apiUrl: string;
  authorizationToken: string;
  allowed?: { capabilities?: string[] };
};
const capabilities = authorization.allowed?.capabilities ?? [];
const requiredSetupCapabilities = ["writeKeys"];
const missingCapabilities = requiredSetupCapabilities.filter(
  (capability) => !capabilities.includes(capability),
);

if (missingCapabilities.length > 0) {
  throw new Error(`B2 setup key lacks: ${missingCapabilities.join(", ")}.`);
}

async function callB2<T>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${authorization.apiUrl}/b2api/v4/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: authorization.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accountId: authorization.accountId, ...body }),
  });

  if (!response.ok) {
    throw new Error(`${endpoint} failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as T;
}

const backupKey = await callB2<{
  applicationKeyId: string;
  applicationKey: string;
}>("b2_create_key", {
  bucketIds: [bucketId],
  capabilities: ["listBuckets", "listFiles", "readFiles", "writeFiles"],
  keyName: `my-business-github-backup-${Date.now()}`,
});

let worksheet = await readFile(worksheetPath, "utf8");
const replacements = new Map([
  ["B2_ACCESS_KEY_ID", backupKey.applicationKeyId],
  ["B2_SECRET_ACCESS_KEY", backupKey.applicationKey],
  ["B2_SETUP_KEY_ID", ""],
  ["B2_SETUP_APPLICATION_KEY", ""],
]);

for (const [name, value] of replacements) {
  const pattern = new RegExp(`^${name}=.*$`, "m");
  if (!pattern.test(worksheet)) {
    throw new Error(`${name} is missing from the worksheet.`);
  }
  worksheet = worksheet.replace(pattern, `${name}=${value}`);
}

const temporaryPath = `${worksheetPath}.tmp`;
await writeFile(temporaryPath, worksheet, { encoding: "utf8", mode: 0o600 });
await rename(temporaryPath, worksheetPath);
await chmod(worksheetPath, 0o600);

console.log("Narrow B2 backup key stored locally.");
console.log("Temporary B2 setup credentials blanked.");
