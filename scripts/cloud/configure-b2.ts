export {};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const applicationKeyId = required("B2_ACCESS_KEY_ID");
const applicationKey = required("B2_SECRET_ACCESS_KEY");
const bucketId = required("B2_BUCKET_ID");
const authorizeResponse = await fetch(
  "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
  {
    headers: {
      Authorization: `Basic ${Buffer.from(`${applicationKeyId}:${applicationKey}`).toString("base64")}`,
    },
  },
);
if (!authorizeResponse.ok) {
  throw new Error(
    `B2 authorization failed with HTTP ${authorizeResponse.status}.`,
  );
}

const authorization = (await authorizeResponse.json()) as {
  accountId: string;
  apiUrl: string;
  authorizationToken: string;
  allowed?: { capabilities?: string[] };
};
if (!authorization.allowed?.capabilities?.includes("writeBuckets")) {
  throw new Error("The configured B2 key cannot update lifecycle policy.");
}

const response = await fetch(
  `${authorization.apiUrl}/b2api/v3/b2_update_bucket`,
  {
    method: "POST",
    headers: {
      Authorization: authorization.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accountId: authorization.accountId,
      bucketId,
      lifecycleRules: [
        {
          fileNamePrefix: "backup/database/daily/",
          daysFromUploadingToHiding: 14,
          daysFromHidingToDeleting: 1,
        },
        {
          fileNamePrefix: "backup/database/weekly/",
          daysFromUploadingToHiding: 56,
          daysFromHidingToDeleting: 1,
        },
      ],
    }),
  },
);
if (!response.ok) {
  throw new Error(`B2 bucket update failed with HTTP ${response.status}.`);
}

const result = (await response.json()) as { lifecycleRules?: unknown[] };
console.log(`lifecycle-rule-count=${result.lifecycleRules?.length ?? 0}`);
