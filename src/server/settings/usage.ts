import "server-only";

import { sql } from "drizzle-orm";

import { getDatabase } from "../db/client";
import { logError } from "../observability/logger";
import type { BadgeTone } from "./status";

/*
 * Free-tier headroom.
 *
 * Every provider under this app is on a free tier, so the interesting
 * question on Settings is not "is it up" but "how close is it to the cap".
 * Only three of those caps can be measured from inside the app without
 * handing the runtime another provider's credentials, so those three get
 * meters and the rest are printed as the plain facts they are (see
 * freeTierAllowances below).
 *
 * Providers bill storage in decimal GB, so this file counts in decimal GB
 * too - a meter that disagrees with the invoice is worse than no meter.
 */
const gigabyte = 1_000_000_000;

// Checked against provider docs on 2026-09-16. Re-check when a bill or a
// dashboard disagrees with a meter here; these are marketing-page numbers,
// not an API, so they move without telling us.
export const r2FreeStorageBytes = 10 * gigabyte;
export const b2FreeStorageBytes = 10 * gigabyte;
export const neonFreeStorageBytes = 0.5 * gigabyte;

export type UsageMeter = {
  id: string;
  /** The provider and plan the cap belongs to. */
  provider: string;
  /** What is being measured, in the provider's own words. */
  measure: string;
  usedBytes: number;
  limitBytes: number;
  /** What the number counts, and - more usefully - what it does not. */
  caveat: string;
};

export type FreeTierUsage = {
  meters: UsageMeter[];
  objectCount: number;
  ok: boolean;
  detail: string;
};

type UsageRow = {
  database_bytes: string | number;
  object_bytes: string | number;
  object_count: string | number;
};

/*
 * One round trip for all three numbers. `pg_database_size` is a function of a
 * constant rather than a column, so it rides along with the aggregate without
 * a GROUP BY.
 */
const usageQuery = sql`
  select
    coalesce(sum(size_bytes), 0) as object_bytes,
    count(*) as object_count,
    pg_database_size(current_database()) as database_bytes
  from document_files
`;

export async function checkFreeTierUsage(): Promise<FreeTierUsage> {
  try {
    const result = await getDatabase().execute(usageQuery);
    const row = (result.rows as UsageRow[])[0];
    if (!row) throw new Error("The usage query returned no rows.");

    const objectBytes = Number(row.object_bytes);
    const databaseBytes = Number(row.database_bytes);

    return {
      detail: "Measured when this page loaded.",
      meters: [
        {
          caveat:
            "Summed from the file index, not a bucket listing - anything in the bucket the database does not know about is uncounted.",
          id: "r2",
          limitBytes: r2FreeStorageBytes,
          measure: "Stored objects",
          provider: "Cloudflare R2 · Free",
          usedBytes: objectBytes,
        },
        {
          caveat:
            "B2 mirrors every R2 object one for one, so the mirror is at least this big. Nightly database dumps live in the same bucket and are not counted here.",
          id: "b2",
          limitBytes: b2FreeStorageBytes,
          measure: "Mirrored objects",
          provider: "Backblaze B2 · Free",
          usedBytes: objectBytes,
        },
        {
          caveat:
            "The whole Postgres database on disk: rows, indexes and bloat. Document bytes are not in here - they live in R2.",
          id: "neon",
          limitBytes: neonFreeStorageBytes,
          measure: "Database on disk",
          provider: "Neon · Free",
          usedBytes: databaseBytes,
        },
      ],
      objectCount: Number(row.object_count),
      ok: true,
    };
  } catch (error) {
    // Same reasoning as checkDatabaseStatus: the driver error names hosts and
    // roles, so it goes to the log and a sentence goes to the browser.
    logError("settings.usage_check_failed", error);
    return {
      detail: "Usage could not be measured. Check the server logs.",
      meters: [],
      objectCount: 0,
      ok: false,
    };
  }
}

/** Percentage of a cap, one decimal, clamped so a bar never overruns its track. */
export function meterPercent(usedBytes: number, limitBytes: number): number {
  if (limitBytes <= 0) return 0;
  const percent = (usedBytes / limitBytes) * 100;
  return Math.min(100, Math.max(0, Math.round(percent * 10) / 10));
}

/*
 * Cream at 70%: a free tier that fills has weeks of warning, and the only
 * useful moment to say something is before the last one.
 */
export function meterTone(percent: number): BadgeTone {
  if (percent >= 90) return "error";
  if (percent >= 70) return "warning";
  return "success";
}

export type ProviderAllowance = {
  href: string;
  items: string[];
  provider: string;
};

/*
 * The caps that would need another provider's API credentials in the app to
 * measure - which is exactly what this app does not do (B2 credentials never
 * reach the runtime at all). Printed as reference, with the dashboard that
 * has the live number one click away. Checked 2026-09-16.
 */
export const freeTierAllowances: ProviderAllowance[] = [
  {
    href: "https://developers.cloudflare.com/r2/pricing/",
    items: [
      "1,000,000 Class A operations a month (writes, lists)",
      "10,000,000 Class B operations a month (reads)",
      "Egress is free and unmetered",
    ],
    provider: "Cloudflare R2",
  },
  {
    href: "https://www.backblaze.com/cloud-storage/pricing",
    items: [
      "Egress free up to 3× the average monthly stored bytes",
      "Class A, B and C API calls are free",
      "First 2,500 Class D calls a day are free",
    ],
    provider: "Backblaze B2",
  },
  {
    href: "https://neon.com/docs/introduction/plans",
    items: [
      "100 CU-hours of compute a month",
      "5 GB of public network transfer a month",
      "10 branches; compute suspends after 5 idle minutes",
    ],
    provider: "Neon",
  },
  {
    href: "https://vercel.com/docs/limits/fair-use-guidelines",
    items: [
      "100 GB fast data transfer a month",
      "1,000,000 function invocations a month",
      "4 hours active CPU and 360 GB-hrs provisioned memory a month",
      "100 deployments a day",
    ],
    provider: "Vercel Hobby",
  },
];
