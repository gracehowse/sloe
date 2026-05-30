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

/** Read a PostHog feature flag synchronously. Returns `false` when
 *  PostHog isn't initialised (e.g. SSR, NEXT_PUBLIC_POSTHOG_KEY
 *  missing, or the flag hasn't loaded yet). The callsite must tolerate
 *  the false-default — it can't tell apart "flag is off" from "flag
 *  isn't loaded yet" without an extra round-trip.
 *
 *  Stage E (onboarding v2) uses this to decide whether to redirect
 *  /onboarding → /onboarding/v2. */
export function isFeatureEnabled(flag: string): boolean {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return false;
  try {
    return posthog.isFeatureEnabled(flag) === true;
  } catch {
    return false;
  }
}

/** Fail-safe kill switch over already-shipped, default-ON behaviour.
 *  Returns `true` ONLY when PostHog is initialised AND the flag resolves
 *  explicitly to `false`. When PostHog is missing, the flag is unloaded,
 *  or the flag doesn't exist, returns `false` ("not disabled") so the
 *  gated behaviour proceeds.
 *
 *  This is deliberately NOT `!isFeatureEnabled(flag)`: the plain
 *  `isFeatureEnabled` collapses "off" and "not loaded yet" into the same
 *  `false`, so negating it would skip the behaviour whenever PostHog is
 *  cold — which, during onboarding completion, is the common case. Use
 *  `isFeatureDisabled` for kill switches where the safe cold default is
 *  ON (e.g. `onboarding_default_seeds`, live on mobile since 2026-04-30
 *  — a stale skip would leave the user's library empty). */
export function isFeatureDisabled(flag: string): boolean {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return false;
  try {
    return posthog.isFeatureEnabled(flag) === false;
  } catch {
    return false;
  }
}

/**
 * 2026-04-27: removed the web `isOnboardingV2Enabled` + `subscribeToFlags`
 * helpers — the only consumer was `app/onboarding/legacy-form.tsx` which
 * was deleted as part of the onboarding-v2 100%-rollout cleanup
 * (docs/decisions/2026-04-27-delete-legacy-onboarding.md). The web
 * /onboarding route now redirects unconditionally to /onboarding/v2.
 *
 * Mobile keeps its own copies in apps/mobile/lib/analytics.ts because
 * the mobile onboarding-v2 ramp is on a separate track (still gated).
 * Restore here if the web flag-gating ever needs to come back.
 */

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
