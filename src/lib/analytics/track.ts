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
const FORCE_FLAGS_STORAGE_KEY = "__suppr_force_flags__";
let forcedFlagsSeeded = false;

/** Dev-only (ENG-840): hydrate `window.__SUPPR_FORCE_FLAGS__` from the
 *  `?__force_flags=` query param and/or localStorage so a flag can be
 *  forced for MANUAL browsing — not just Playwright's addInitScript.
 *
 *  Format: `?__force_flags=redesign_motion:on,today-status-pills:off`
 *  (`on`/`true`/`1` → ON, `off`/`false`/`0` → OFF; a bare `flag` with no
 *  state means ON). `?__force_flags=clear` wipes the persisted set. The
 *  parsed set is persisted to localStorage so it survives client-side
 *  navigation; clear it with `clear` or by removing the storage key.
 *
 *  Runs once per page load, lazily on the first flag read, so there's no
 *  provider-ordering dependency — the override is present before any
 *  component resolves a flag. Inert in production (the caller guards on
 *  NODE_ENV). */
function seedForcedFlagsFromLocation(): void {
  if (forcedFlagsSeeded) return;
  forcedFlagsSeeded = true;
  if (typeof window === "undefined") return;
  const w = window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> };
  let map: Record<string, boolean> = { ...(w.__SUPPR_FORCE_FLAGS__ ?? {}) };
  // 1. localStorage — persisted from a prior load.
  try {
    const stored = window.localStorage.getItem(FORCE_FLAGS_STORAGE_KEY);
    if (stored) {
      map = { ...map, ...(JSON.parse(stored) as Record<string, boolean>) };
    }
  } catch {
    /* private mode / storage denied / malformed — ignore */
  }
  // 2. Query-param overlay — highest precedence, also persisted.
  try {
    const raw = new URLSearchParams(window.location.search).get("__force_flags");
    if (raw !== null) {
      if (raw.trim() === "clear") {
        map = {};
        window.localStorage.removeItem(FORCE_FLAGS_STORAGE_KEY);
      } else {
        for (const part of raw.split(",")) {
          const [rawFlag, rawState] = part.split(":");
          const f = rawFlag?.trim();
          if (!f) continue;
          const state = rawState?.trim().toLowerCase();
          if (state === "off" || state === "false" || state === "0") {
            map[f] = false;
          } else if (
            state === undefined ||
            state === "on" ||
            state === "true" ||
            state === "1"
          ) {
            map[f] = true;
          }
        }
        try {
          window.localStorage.setItem(
            FORCE_FLAGS_STORAGE_KEY,
            JSON.stringify(map),
          );
        } catch {
          /* best-effort persistence */
        }
      }
    }
  } catch {
    /* no URL / unsupported — ignore */
  }
  w.__SUPPR_FORCE_FLAGS__ = map;
}

/** Test-only: reset the once-per-load seed guard so a test can exercise
 *  `seedForcedFlagsFromLocation` repeatedly with different query params /
 *  localStorage state. No-op effect on production behaviour. */
export function __resetForcedFlagSeedForTests(): void {
  forcedFlagsSeeded = false;
}

function flagForceOverride(flag: string): boolean | null {
  if (process.env.NODE_ENV === "production") return null;
  // Client-side override: Playwright seeds `window.__SUPPR_FORCE_FLAGS__`
  // via addInitScript (tests/e2e/utils/visual.ts#forceFlagsOn); for manual
  // browsing, `seedForcedFlagsFromLocation` hydrates the same global from
  // `?__force_flags=` + localStorage (ENG-840). This is the CLIENT force
  // path — Next.js does NOT inline a *computed* `process.env["NEXT_PUBLIC_"
  // + key]` read into the browser bundle (only static
  // `process.env.NEXT_PUBLIC_X` is replaced), so the env branch below is
  // effective SSR/server-side only. The window hook is therefore the only
  // way to force a flag for client-rendered components — most of the
  // redesign-gated UI. Inert in production (guarded above) and whenever the
  // global is unset.
  if (typeof window !== "undefined") {
    seedForcedFlagsFromLocation();
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
/** Redesign 2026 flag set — the new design is the DEFAULT in every build
 *  (Grace 2026-06-01: "turn everything on; never flag-gate again"). These
 *  resolve ON regardless of PostHog rollout state; the PostHog rows survive
 *  only as emergency kill switches via `isFeatureDisabled`. An explicit
 *  dev/test force (above) still wins, so pre-redesign captures keep working.
 *  Keep in sync with the same set in `apps/mobile/lib/analytics.ts`. */
const REDESIGN_DEFAULT_ON = new Set<string>([
  "design_system_elevation",
  "design_system_colours",
  "design_system_brandmark",
  "design_system_icons",
  "redesign_winmoment",
  "redesign_motion",
  "redesign_branded_sheets",
  "redesign_search_results",
  "today-weekly-insight-mobile",
  "today_meals_figma_654",
  // ENG-1085 — recipe-detail "Fits your day" confident verdict banner (mirror
  // of the mobile default-on; legacy 10%-wash pill stays as the kill switch).
  "fit_verdict_banner_v1",
]);

export function isFeatureEnabled(flag: string): boolean {
  const forced = flagForceOverride(flag);
  if (forced !== null) return forced;
  if (REDESIGN_DEFAULT_ON.has(flag)) return true;
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

/** Returns the PostHog payload JSON attached to `flag` in the dashboard,
 *  or null when PostHog is cold / the flag has no payload. Lets a
 *  kill-switch banner's copy change without a deploy — e.g. the
 *  `dr-full-outage-banner` DR kill switch (disaster-recovery runbook
 *  row 7). Mirror of `apps/mobile/lib/analytics.ts#getFeatureFlagPayload`. */
export function getFeatureFlagPayload(flag: string): unknown {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  try {
    return posthog.getFeatureFlagPayload(flag) ?? null;
  } catch {
    return null;
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
