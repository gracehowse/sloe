"use client";

import posthog from "posthog-js";
import type { AnalyticsEventName } from "./events.ts";
import { FIRST_LOG_LOCAL_KEY, firstLogTimestamp, shouldMarkFirstLog } from "./firstLog.ts";

export function track(event: AnalyticsEventName, props?: Record<string, unknown>): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.capture(event, props);
    // L6 G2 (2026-04-18) — the very first `food_logged` per user
    // becomes a PostHog person property so activation dashboards
    // can compute D1/D7 cohort retention off one clean signal.
    if (event === "food_logged") {
      void maybeMarkFirstLog();
    }
  } catch {
    /* ignore */
  }
}

function maybeMarkFirstLog(): void {
  if (typeof window === "undefined") return;
  try {
    const existing = window.localStorage.getItem(FIRST_LOG_LOCAL_KEY);
    if (!shouldMarkFirstLog(existing)) return;
    const ts = firstLogTimestamp();
    // `setPersonProperties(setAlways, setOnce)` — the second arg is
    // `$set_once` which is idempotent server-side, so if two devices
    // race, the earliest timestamp wins.
    posthog.setPersonProperties({}, { first_log_at: ts });
    window.localStorage.setItem(FIRST_LOG_LOCAL_KEY, ts);
  } catch {
    /* storage denied or SDK not ready — ignore, next log retries */
  }
}
