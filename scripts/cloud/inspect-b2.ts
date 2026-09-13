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
  "https://api.backblazeb2.com/b2api/v4/b2_authorize_account",
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
  authorizationToken: string;
  apiInfo: {
    storageApi: {
      apiUrl: string;
      allowed?: {
        buckets?: Array<{ id: string; name: string | null }>;
        capabilities?: string[];
      };
    };
  };
};
const storageApi = authorization.apiInfo.storageApi;
const listResponse = await fetch(
  `${storageApi.apiUrl}/b2api/v4/b2_list_buckets`,
  {
    method: "POST",
    headers: {
      Authorization: authorization.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accountId: authorization.accountId, bucketId }),
  },
);
if (!listResponse.ok) {
  throw new Error(
    `B2 bucket inspection failed with HTTP ${listResponse.status}.`,
  );
}

const result = (await listResponse.json()) as {
  buckets: Array<{
    bucketId: string;
    bucketName: string;
    bucketType: string;
    fileLockConfiguration?: {
      isClientAuthorizedToRead?: boolean;
      value?: { isFileLockEnabled?: boolean };
    };
    lifecycleRules?: unknown[];
  }>;
};
const bucket = result.buckets.find(
  (candidate) => candidate.bucketId === bucketId,
);
if (!bucket) {
  throw new Error(
    "The configured B2 application key cannot inspect B2_BUCKET_ID.",
  );
}

const expectedBackupCapabilities = [
  "listBuckets",
  "listFiles",
  "readFiles",
  "writeFiles",
];
const actualCapabilities = [...(storageApi.allowed?.capabilities ?? [])].sort();
const exactBackupCapabilities =
  actualCapabilities.length === expectedBackupCapabilities.length &&
  expectedBackupCapabilities.every((capability) =>
    actualCapabilities.includes(capability),
  );
const allowedBuckets = storageApi.allowed?.buckets ?? [];
const objectLockReadable =
  bucket.fileLockConfiguration?.isClientAuthorizedToRead === true;

console.log(`bucket-name=${bucket.bucketName}`);
console.log(`bucket-private=${bucket.bucketType === "allPrivate"}`);
console.log(`object-lock-readable=${objectLockReadable}`);
console.log(
  `object-lock-enabled=${objectLockReadable ? bucket.fileLockConfiguration?.value?.isFileLockEnabled === true : "unknown"}`,
);
console.log(`lifecycle-rule-count=${bucket.lifecycleRules?.length ?? 0}`);
console.log(
  `key-bucket-restricted=${allowedBuckets.length === 1 && allowedBuckets[0]?.id === bucketId}`,
);
console.log(`key-exact-backup-capabilities=${exactBackupCapabilities}`);
console.log(`key-can-delete=${actualCapabilities.includes("deleteFiles")}`);
console.log(`key-can-manage-keys=${actualCapabilities.includes("writeKeys")}`);
console.log(
  `key-can-manage-buckets=${actualCapabilities.includes("writeBuckets")}`,
);
console.log(
  `key-can-manage-retention=${actualCapabilities.includes("writeBucketRetentions")}`,
);
console.log(
  `key-can-read-retention=${actualCapabilities.includes("readBucketRetentions")}`,
);
