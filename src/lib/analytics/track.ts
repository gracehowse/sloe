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

/** Dev / E2E flag-force override (mirrors the mobile hook at
 *  `apps/mobile/lib/analytics.ts#isFeatureEnabled`, lines ~201-207).
 *  When NOT a production build, read `NEXT_PUBLIC_FLAG_FORCE_<FLAG_KEY>`
 *  and honour `"1"`/`"true"` (force ON) or `"0"`/`"false"` (force OFF);
 *  any other value (or unset) falls through to the live PostHog client.
 *
 *  This exists so Playwright visual specs can capture flag-ON goldens —
 *  the committed auth fixture seeds an empty PostHog flag set, so without
 *  a force layer only the flag-OFF path is ever rendered (gap #13,
 *  ENG P5 parity worklist). It is inert in production: the
 *  `NODE_ENV !== "production"` guard short-circuits before the env read,
 *  so shipped builds keep the exact same PostHog-only behaviour.
 *
 *  Mapping: uppercase the flag key and replace hyphens with underscores
 *  (env-var names can't contain hyphens), identical to mobile's
 *  `EXPO_PUBLIC_FLAG_FORCE_*`. So `redesign_branded_sheets` →
 *  `NEXT_PUBLIC_FLAG_FORCE_REDESIGN_BRANDED_SHEETS`, and the hyphenated
 *  `log-sheet-slot-selector` → `NEXT_PUBLIC_FLAG_FORCE_LOG_SHEET_SLOT_SELECTOR`.
 *  Returns `null` when no override applies. */
function flagForceOverride(flag: string): boolean | null {
  if (process.env.NODE_ENV === "production") return null;
  // Client-side override: Playwright (and any dev tool) seeds
  // `window.__SUPPR_FORCE_FLAGS__` via addInitScript before the app loads (see
  // tests/e2e/utils/visual.ts#forceFlagsOn). This is the CLIENT force path —
  // Next.js does NOT inline a *computed* `process.env["NEXT_PUBLIC_" + key]`
  // read into the browser bundle (only static `process.env.NEXT_PUBLIC_X` is
  // replaced), so the env branch below is effective SSR/server-side only. The
  // window hook is therefore the only way to force a flag for client-rendered
  // components — which is most of the redesign-gated UI. Inert in production
  // (guarded above) and whenever the global is unset.
  if (typeof window !== "undefined") {
    const forced = (window as { __SUPPR_FORCE_FLAGS__?: Record<string, unknown> })
      .__SUPPR_FORCE_FLAGS__;
    if (forced && Object.prototype.hasOwnProperty.call(forced, flag)) {
      if (forced[flag] === true) return true;
      if (forced[flag] === false) return false;
    }
  }
  const envKey = `NEXT_PUBLIC_FLAG_FORCE_${flag.toUpperCase().replace(/-/g, "_")}`;
  const override = process.env[envKey];
  if (override === "1" || override === "true") return true;
  if (override === "0" || override === "false") return false;
  return null;
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
  const forced = flagForceOverride(flag);
  if (forced !== null) return forced;
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
 *  — a stale skip would leave the user's library empty).
 *
 *  Honours the same dev/test `NEXT_PUBLIC_FLAG_FORCE_*` override as
 *  `isFeatureEnabled` (mirror of the mobile hook): a forced-OFF flag is
 *  "disabled" (`true`); a forced-ON flag is "not disabled" (`false`).
 *  Inert in production. */
export function isFeatureDisabled(flag: string): boolean {
  const forced = flagForceOverride(flag);
  if (forced !== null) return !forced;
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
