import * as Sentry from "@sentry/nextjs";

import { AnalyticsEvents } from "@/lib/analytics/events";
import { serverTrack } from "@/lib/analytics/serverTrack";
import { getRedis } from "./upstashClient";
import type { VendorId } from "./vendorSearchCache";

const ALARM_PREFIX = "pm_vsd_alarm";

const gVsd = globalThis as unknown as {
  __pm_vsdAlarmFired?: Set<string>;
};

function quotaWindowId(windowSec: number): number {
  return Math.floor(Date.now() / 1000 / windowSec);
}

function alarmKey(vendor: VendorId, windowId: number): string {
  return `${ALARM_PREFIX}:${vendor}:${windowId}`;
}

async function claimAlarmOnce(vendor: VendorId, windowSec: number): Promise<boolean> {
  const windowId = quotaWindowId(windowSec);
  const key = alarmKey(vendor, windowId);
  const redis = getRedis();

  try {
    if (redis) {
      const claimed = await redis.set(key, "1", { nx: true, ex: windowSec });
      return claimed === "OK";
    }
    const fired = (gVsd.__pm_vsdAlarmFired ??= new Set<string>());
    if (fired.has(key)) return false;
    fired.add(key);
    return true;
  } catch {
    // Best-effort dedup — if Redis blips, prefer emitting the alert over silence.
    return true;
  }
}

export type VendorSearchDegradedMetric = {
  vendor: VendorId;
  guard: "check" | "consume";
  used: number;
  cap: number;
  trip: number;
  windowSec: number;
  label: string;
};

/**
 * ENG-1412 / PRA-011 — emit an alertable signal when a vendor's account-wide
 * quota guard trips and search degrades out of that source. De-duped to once
 * per vendor per quota window (hourly for USDA, daily for Edamam/FatSecret/OFF)
 * so a sustained outage does not spam PostHog/Sentry.
 */
export async function recordVendorSearchDegraded(metric: VendorSearchDegradedMetric): Promise<void> {
  const { vendor, guard, used, cap, trip, windowSec, label } = metric;
  const claimed = await claimAlarmOnce(vendor, windowSec);
  if (!claimed) return;

  const properties = {
    vendor,
    guard,
    reason: "quota_exhausted",
    used,
    cap,
    trip,
    window_sec: windowSec,
    label,
  };

  console.warn(
    `[vendorSearchCache] DEGRADED — vendor=${vendor} used=${used} cap=${cap} trip=${trip} windowSec=${windowSec}`,
  );

  try {
    Sentry.captureMessage(`Vendor search degraded — ${vendor}`, {
      level: "warning",
      tags: {
        dependency: "vendor_search",
        vendor,
        reason: "quota_exhausted",
      },
      extra: properties,
      fingerprint: ["vendor_search_degraded", vendor, "quota_exhausted"],
    });
  } catch {
    // Best-effort monitoring must never change the degrade decision.
  }

  void serverTrack(AnalyticsEvents.vendor_search_degraded, "system:vendor_quota", properties).catch(
    () => {
      // Best-effort metric emission; the route owns the degraded response.
    },
  );
}

/** Test-only — clear the in-memory alarm dedup set. */
export function _resetVendorSearchMonitoringForTest(): void {
  gVsd.__pm_vsdAlarmFired = new Set();
}
