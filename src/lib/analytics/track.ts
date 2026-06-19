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
/**
 * Default-OFF feature flags (NOT in `REDESIGN_DEFAULT_ON`). Listed here so
 * the flag is discoverable on both platforms even though "registration" is
 * really just "the callsite calls `isFeatureEnabled(...)` and the flag is
 * absent from every default-on set". A flag not in `REDESIGN_DEFAULT_ON`
 * and not live in PostHog resolves to `false` — the safe dark default.
 *
 * - `cook_step_ingredients_v1` (ENG-944) — renders the calm "For this step"
 *   ingredient chip row under each cook-mode instruction. DEFAULT-OFF;
 *   ramp via PostHog once visually validated on device. Mirror of the
 *   mobile note in `apps/mobile/lib/analytics.ts`.
 */

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
  // ENG-1087 — Discover import-from-Reel card promoted to a hero affordance
  // (stronger tint + solid plum icon + "Paste link" pill). Legacy nav-row slab
  // stays in the `else` as the kill switch.
  "discover_import_hero_v1",
  // ENG-1089 — render the Discover import card ABOVE the cluster carousels on web
  // mobile-web (mobile native already shows it first; this is the web↔mobile
  // parity fix). WEB-ONLY — mobile has no carousel branch, so there is no mobile
  // mirror. Legacy below-carousels position is the kill switch.
  "discover_import_above_carousels_v1",
  // ENG-1086 — empty cold-open calorie ring paints the brand-gradient loop
  // instead of a grey skeleton (mirror of mobile; legacy grey empty as kill switch).
  "ring_empty_gradient_v1",
  // ENG-1093 — empty + Show-macros parity: an empty day with macros SHOWN renders
  // the populated multi-ring unpopulated (calorie track + 3 grey macro tracks)
  // instead of the single bold cold-open loop, so it matches a populated day
  // exactly, just empty (Grace 2026-06-13). Collapsed-empty keeps the ENG-1086
  // loop. Default-on; off → empty always shows the single loop (pre-ENG-1093).
  "ring_empty_macro_parity_v1",
  // ENG-1081 — card-fill cohesion: Progress "This Week" insight card + Settings
  // "Sloe Pro" banner render as flat WHITE slabs (mirror of mobile; legacy lilac
  // insight wash / aubergine Pro tint kept behind the flag-off path).
  "card_cohesion_white_v1",
  // ENG-1095 — web Today meals render the four standard slots (Breakfast/Lunch/
  // Dinner/Snacks) ALWAYS, matching mobile's fixed `slots` list. Web-only (mobile
  // already does this). Default-on; off → the legacy populated-only list + the
  // single "Log a meal" empty card (kill switch).
  "today_meals_all_slots_v1",
  // ENG-1092 — "Purposeful empties": empty meal slots (Today + Plan) show a
  // tinted icon + "Aim ~X kcal" (redistributed budget) instead of a bare name /
  // "Empty slot", and empty slots render at full opacity. Default-on; off → the
  // pre-ENG-1092 empties (bare name on Today, "Empty slot" on Plan).
  "plan_today_aim_empty_v1",
  // ENG-1092 increment 3 — web Plan config rows (Plan length / Slots / Start)
  // collapse behind one "Adjust plan" popover (parity with mobile). Default-on
  // (Grace 2026-06-14: ship + roll back if disliked). OFF → the three inline rows.
  "plan_adjust_collapsed_v1",
  // ENG-1099 — Today tracker → recipe-tier craft pass (M1–M6: one 24 rhythm,
  // flat cards, stripped macro tiles w/ value-colour over-signal, two serif
  // tiers, quieted washes, de-chromed meal log). Default-on; OFF → the
  // pre-ENG-1099 tracker. Rollback = remove from this set / PostHog off.
  "today_tracker_tier_v1",
  // ENG-1131 — web Plan parity: move-meal picker, templates dialog, portion
  // stepper (mobile already ships). Default-on; off → swap-only affordance.
  "plan_web_parity_v1",
  // ENG-1129 — cook-mode "Log this meal" confirms servings eaten (default 1)
  // instead of silently logging the whole batch scale. Default-on; off → legacy
  // multiply-by-batch-scale path.
  "cook_log_servings_confirm",
  // ENG-771 (Gate 1) — MFP-refugee logging loop (mirror mobile).
  "today_log_again",
  "log-sheet-slot-selector",
  "today_log_usual_row_v2",
  // ENG-978/979 — shareable import-success card + creator credit in share text.
  // Default-on; off → legacy title+URL share only.
  "recipe_share_card_v1",
  // ENG-972 — inline NL text meal logging inside LogSheet (default-on).
  "log_sheet_nl_text_v1",
  // ENG-980 — save-first import lands in Library before review (mobile import).
  "import-save-first-v1",
  // ENG-965 / ENG-990 — surface MFP/MacroFactor refugee app-choice step by default.
  "onboarding-app-choice",
  // ENG-1065 — Planned card empty branch on Today (F-178/F-179). Default-on;
  // off → host hides the card when the plan day has no meals.
  "today_planned_empty_state",
  // ENG-848 — web Today macro tiles/bars open MacroDetailPanel. Web-only:
  // mobile already has the native `macro-detail` route wired from Today.
  "web_macro_detail_panel",
  // ENG-901 — Figma `284:2` inline trust row (· separators, Lock/Calendar
  // glyphs) instead of pill chips on paywall/pricing. Default-on; off → pills.
  "paywall_trust_inline_v1",
  // ENG-901 — web upgrade dialog Sloe Pro hero + inline trust strip. Default-on.
  "paywall_upgrade_dialog_sloe_v1",
  // ENG-889 — coach line renders inside the Today hero card (Figma `654:2`).
  "today_coach_in_hero_v1",
  // ENG-1203 — merchandise the free MFP-switch wins (barcode scanning + custom
  // macros) on the landing Free column + paywall comparison matrix. Default-on;
  // off → the legacy copy without the two free callouts.
  "paywall_free_mfp_wins_v1",
]);

/** Default-OFF flags — registered here as documentation only. They are
 *  deliberately NOT in `REDESIGN_DEFAULT_ON`, so `isFeatureEnabled`
 *  resolves them via PostHog and defaults to `false` when PostHog is cold.
 *  Listing them keeps "is this flag known / on purpose off?" answerable in
 *  one place (the set is not read at runtime — membership has no effect).
 *
 *  - `landing_hero_hybrid_v1` (ENG-1204) — landing hero → HYBRID positioning
 *    (D-07). ON swaps the recipe-first hero for the tracker/coaching
 *    headline + import wedge line; OFF keeps the shipped recipe-first hero.
 *    Default OFF: meaning-changing copy on the top conversion surface, so it
 *    ramps via PostHog only after brand/copy sign-off (Grace). */
export const DEFAULT_OFF_FLAGS = new Set<string>(["landing_hero_hybrid_v1"]);

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
