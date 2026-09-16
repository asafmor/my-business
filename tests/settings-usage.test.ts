import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db/client", () => ({ getDatabase: vi.fn() }));
vi.mock("../src/server/observability/logger", () => ({ logError: vi.fn() }));

import { formatBytes } from "../src/lib/format";
import { getDatabase } from "../src/server/db/client";
import { logError } from "../src/server/observability/logger";
import {
  checkFreeTierUsage,
  meterPercent,
  meterTone,
  neonFreeStorageBytes,
  r2FreeStorageBytes,
} from "../src/server/settings/usage";

function fakeDatabaseReturning(rows: unknown[]) {
  return () => ({ execute: () => Promise.resolve({ rows }) });
}

describe("meterPercent", () => {
  it("reports one decimal of a cap", () => {
    expect(meterPercent(1_234_000_000, r2FreeStorageBytes)).toBe(12.3);
  });

  it("clamps an overrun so a bar cannot escape its track", () => {
    expect(meterPercent(40 * 1_000_000_000, r2FreeStorageBytes)).toBe(100);
    expect(meterPercent(-5, r2FreeStorageBytes)).toBe(0);
  });

  it("returns zero rather than Infinity when a cap is unknown", () => {
    expect(meterPercent(100, 0)).toBe(0);
  });
});

describe("meterTone", () => {
  it("turns cream at 70% and red at 90%", () => {
    expect(meterTone(69.9)).toBe("success");
    expect(meterTone(70)).toBe("warning");
    expect(meterTone(89.9)).toBe("warning");
    expect(meterTone(90)).toBe("error");
  });
});

describe("formatBytes", () => {
  it("counts in the decimal units the providers bill in", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(1_500)).toBe("1.5 KB");
    expect(formatBytes(10_000_000_000)).toBe("10.0 GB");
  });
});

describe("checkFreeTierUsage", () => {
  it("meters R2 off object bytes, B2 off both, and Neon off the database", async () => {
    vi.mocked(getDatabase).mockImplementation(
      fakeDatabaseReturning([
        {
          // pg returns bigint as a string; Number() has to happen somewhere.
          database_bytes: "50000000",
          object_bytes: "2500000000",
          object_count: "42",
        },
      ]) as unknown as typeof getDatabase,
    );

    const usage = await checkFreeTierUsage();

    expect(usage.ok).toBe(true);
    expect(usage.objectCount).toBe(42);
    // B2 holds the object mirror and the database dump, so its meter is the
    // sum of the other two rather than a copy of the first.
    expect(usage.meters.map((meter) => meter.usedBytes)).toEqual([
      2_500_000_000, 2_550_000_000, 50_000_000,
    ]);
    expect(usage.meters[2].limitBytes).toBe(neonFreeStorageBytes);
  });

  it("logs and degrades to no meters when the query fails", async () => {
    vi.mocked(getDatabase).mockImplementation((() => ({
      execute: () => Promise.reject(new Error("postgres://user:pw@host down")),
    })) as unknown as typeof getDatabase);

    const usage = await checkFreeTierUsage();

    expect(usage.ok).toBe(false);
    expect(usage.meters).toEqual([]);
    expect(logError).toHaveBeenCalledWith(
      "settings.usage_check_failed",
      expect.any(Error),
    );
  });
});
