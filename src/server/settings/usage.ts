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
          caveat: "Document files stored by this app.",
          id: "r2",
          limitBytes: r2FreeStorageBytes,
          measure: "Object storage",
          provider: "Cloudflare R2",
          usedBytes: objectBytes,
        },
        {
          // The nightly dump is compressed, so the mirror is smaller than the
          // sum of its sources. Estimating high is the safe direction for a
          // number whose whole job is to warn before a cap arrives.
          caveat: "Estimated: every document file plus the database dump.",
          id: "b2",
          limitBytes: b2FreeStorageBytes,
          measure: "Backup mirror",
          provider: "Backblaze B2",
          usedBytes: objectBytes + databaseBytes,
        },
        {
          caveat: "Records and indexes. Document files are held in R2.",
          id: "neon",
          limitBytes: neonFreeStorageBytes,
          measure: "Database",
          provider: "Neon",
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
 * reach the runtime at all). Listed as reference, with the dashboard that
 * holds the live number one click away. Checked 2026-09-16.
 */
export const freeTierAllowances: ProviderAllowance[] = [
  {
    href: "https://developers.cloudflare.com/r2/pricing/",
    items: [
      "1,000,000 writes and listings a month",
      "10,000,000 reads a month",
      "Unlimited downloads",
    ],
    provider: "Cloudflare R2",
  },
  {
    href: "https://www.backblaze.com/cloud-storage/pricing",
    items: [
      "Downloads free up to 3× the average stored size",
      "Unlimited uploads, listings and downloads",
      "2,500 bucket management calls a day",
    ],
    provider: "Backblaze B2",
  },
  {
    href: "https://neon.com/docs/introduction/plans",
    items: [
      "100 compute hours a month",
      "5 GB of data transfer a month",
      "10 branches, with idle compute paused automatically",
    ],
    provider: "Neon",
  },
  {
    href: "https://vercel.com/docs/limits/fair-use-guidelines",
    items: [
      "100 GB of data transfer a month",
      "1,000,000 function calls a month",
      "4 hours of active CPU a month",
      "100 deployments a day",
    ],
    provider: "Vercel Hobby",
  },
];
