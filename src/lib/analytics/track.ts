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
 * - `reveal-macro-tile-paired-pct` — onboarding reveal-step layout A/B.
 *   DEFAULT-OFF *by design*: Grace ramps it in PostHog only after validating
 *   in TestFlight, so it is deliberately excluded from the ENG-1225 flag-
 *   collapse sweep. Mirror of the mobile note in `apps/mobile/lib/analytics.ts`.
 *
 * (The 5 cook-mode flags moved to `REDESIGN_DEFAULT_ON` in the 2026-06-22
 *  flag-collapse sweep, after the ENG-1230 swipe-surface render bug was fixed
 *  — the v3 cook baseline is now default-on.)
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
  // ENG-863 — user-tapped Sloe image generation, labelling, nutrition-decouple
  // copy, and removal on recipe heroes. Default-on with PostHog as kill switch.
  "recipe_runtime_image_generation_v1",
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
  // ENG-1225 — the v3 jewel watch-dial as the Today hero ring (desktop +
  // mobile-web). Default-on; off → the legacy concentric DailyRing (kill switch).
  // Keep in sync with the mobile set in apps/mobile/lib/analytics.ts.
  "sloe_v3_ring",
  // ENG-1225 Block 5 — the v3 Cookbook editorial shelves (Tonight's pick hero +
  // Fits-your-day / Quick / High-protein) above the Library grid on the All
  // filter. Default-on; off → the flat grid only (kill switch). Mobile + web.
  "sloe_v3_editorial_shelves",
  // ENG-1225 Block 6 — the v3 Discover editorial sections (Quick weeknight
  // no-photo cards + Collections). Default-on; off → the legacy feed without
  // those sections (kill switch). Mobile + web.
  "sloe_v3_discover_editorial",
  // ENG-1225 #14 — the v3 Discover creator plane (creator rail + web featured
  // hero + mobile Following feed). RAMPED ON 2026-06-24 (ENG-1247, Grace's
  // call); self-hides when the `creators` table is empty (seed fallback
  // pre-launch), so it is safe on. Off → the legacy feed (kill switch). M+W.
  "discover_creator_rail_v1",
  // ENG-1225 flag-collapse sweep (2026-06-22, "turn everything on") — the v3
  // Progress refinements that were built but dark-by-default. Each default-on
  // now; off → the respective legacy path (kill switch).
  //   energy equation: the Burned − Eaten = Net triad on Progress.
  "sloe_v3_energy_equation",
  //   Apple Health read-only card (parity with mobile); off → manual entry.
  "web_apple_health_card",
  //   Progress weight empty-state (no weigh-ins yet); off → bare empty chart.
  "web_progress_weight_empty",
  //   Today meal nutrition detail (MealNutritionDialog + slot detail) — fixes
  //   an asymmetric parity break (mobile already live, web was OFF).
  "web_meal_nutrition_detail",
  // ENG-1225 flag-collapse sweep (2026-06-22) — the v3 cook-mode baseline
  // (audit launch-blocker #4). Built (ENG-944/946/947/948/949) but dark-by-
  // default until this sweep; on-device SEE found a swipe-surface render bug
  // (step body invisible), FIXED in ENG-1230 before flipping these on.
  // Default-on now, off → pre-v3 cook (kill switch). Keep in sync with mobile.
  "cook_step_ingredients_v1",
  "cook_swipe_steps_v1",
  "cook_ingredient_checklist_v1",
  "cook_multi_timers_v1",
  "cook_text_size_control_v1",
  // ENG-1225 #3 — unified "import anything" sheet — web parity with iOS (already
  // default-on there, analytics.ts). Off → the legacy Discover-card → /import nav
  // (kill switch). Web twin: src/app/components/suppr/unified-import-sheet.tsx
  // (live-flow SEE-verified). Closes the audit's web-import parity launch-blocker.
  "sloe_v3_unified_import",
  // ENG-1247 flag-collapse (2026-06-29, Grace) — conformance batch default-on;
  // PostHog remains the kill switch via isFeatureDisabled. Keep in sync w/ mobile.
  "loghub_quick_actions_v1",
  "recipe_detail_v3_conformance",
  "profile_showcase_v1",
  // ENG-1246 (Gap #16) — the shared editorial Profile block: identity → streak
  // dots + best/freezes line → milestones list → recipe grid, replacing the two
  // divergent inline strips. Default-on; off → the legacy "More" hub / showcase
  // (kill switch). Keep in sync with apps/mobile/lib/analytics.ts.
  "sloe_v3_profile",
  "mfp_tracker_reassurance_v1",
  "today_hero_decard_v3",
  "today_quickadd_recents_v3",
  "eng1247_section_a_v1",
  "weekly_recap_detail_v1",
  // ENG-1225 #24 — web Settings two-pane layout (WEB-ONLY).
  "sloe_v3_settings",
  // ENG-1204 / D-07 — landing hero HYBRID positioning (WEB-ONLY). Signed off
  // 2026-06-29 (Grace); off → recipe-first HERO_CURRENT kill switch.
  "landing_hero_hybrid_v1",
  // ENG-751 — macro-detail per-ingredient display from snapshot rows.
  "nutrition_entry_ingredients_v1",
  // ENG-956 — per-meal lock + "Refresh the rest" partial regenerate.
  "plan_meal_lock_v1",
  // ENG-1261 / B28 — keep vs clear reset-plan sheet before regenerate.
  "reset_plan_confirm_v1",
  // ENG-1260 / B26 — 3-step delete-account sheet (reason + ledger + type DELETE).
  "delete_account_sheet_v1",
  // ENG-953 — calm "Expenditure" trend card on Progress, under Maintenance.
  // FLIPPED DEFAULT-ON 2026-06-30 (Grace, "always flag on" for beta-window
  // growth builds — the solo tester should see her own features, not dark
  // flags). Off → the card hides and the collapsed "How this works" expandable
  // stays the live path (kill switch: remove here / PostHog). Web + mobile.
  "expenditure_trend_card",
  // ENG-1237 — body fat + derived lean-mass trends on Progress (Pro-gated).
  // DEFAULT-ON per ENG-1279 — off → card hidden (kill switch). Web + mobile.
  "body_composition_trends_v1",
  // ENG-1279 "always flag on" batch (2026-06-30, Grace) — beta-window growth
  // builds flipped default-ON so the solo tester sees them; each keeps its
  // legacy/empty else as the kill switch (remove here / PostHog). Web + mobile.
  "progress_plateau_insight_v1", // ENG-954 — calm plateau insight line
  "weigh_in_reminder_v1",        // ENG-955 — opt-in weigh-in reminder Settings surface
  "portion_fit_hint_v1",         // ENG-854 — portion-fit hint in food-search preview
  // ENG-855 / make-anything-fit Mode B — distribute-around-anchor on the Plan
  // tab. When the user drops a meal they *want* into the plan, the remaining
  // day budget spreads across the other open slots as per-slot calorie + macro
  // budgets, with a body-neutral, enabling-not-restricting summary line. Math:
  // `distributeAroundAnchor` in `@suppr/shared/nutrition/distributeAroundAnchor`;
  // a low-confidence anchor → qualitative fallback, never a fabricated per-slot
  // number. DEFAULT-ON per ENG-1279 ("always flag on" so the solo tester sees
  // it); the legacy Plan view (no Mode-B band) stays in the `else` as the kill
  // switch. Web + mobile — keep in sync with apps/mobile/lib/analytics.ts.
  "plan_distribute_anchor_v1",
  // ENG-1240 — full Coach screen (Today's read + ranked suggestions + Ask chips).
  // Off → Today coach line stays one-liner only; no /coach destination.
  "coach_screen_v1",
  // ENG-943 — "Add to shopping list" from a single recipe (web RecipeDetail +
  // mobile recipe/[id]). Parses the recipe's ingredients, aggregates duplicates
  // (count-to-weight normalise where high-confidence, never guesses a weight),
  // and APPENDS to the user's list (merging rows already there). DEFAULT-ON per
  // Grace's "always flag on" policy (ENG-1279) — off → the action is hidden and
  // the list stays plan-only (kill switch: remove here / PostHog). Web + mobile.
  "recipe_shopping_list_v1",
  // ENG-1235 — owner Claim → Official macros provenance toggle. DEFAULT-ON per
  // beta-window policy; off → owner action is hidden while the server route
  // remains protected by auth/ownership/service-role checks. Web + mobile.
  "official_recipe_claim_v1",
  // ENG-1236 — referral / invite-for-Pro growth loop in household invite
  // surfaces. Default-on for beta-window growth builds; off hides the new
  // referral card while leaving the existing household invite flow intact.
  // Web + mobile.
  "referral_invite_loop_v1",
  // ENG-728 — CALM one-shot import-success win-moment overlay (log-confirm,
  // reduce-motion → instant). DEFAULT-ON per ENG-1279 ("always flag on") — off →
  // the success sheet renders verbatim (kill switch). Web + mobile.
  "import_magic_moment",
  // ENG-969 — calm single-line projected-weight chart on the Pro paywall (shared
  // computeTrajectory; renders only when a real projection exists). DEFAULT-ON per
  // ENG-1279 — off → paywall without the chart (kill switch). Web + mobile.
  "paywall_trajectory_chart_v1",
  // ENG-957 — plan→shopping-list edit-driven re-sync. Adding / removing /
  // swapping a meal in the Plan keeps the list in sync via the shared appender
  // (ENG-943) + remover: an add appends+merges (preserving checked rows), a
  // remove/swap decrements only the outgoing recipe's contribution (provenance
  // = the `source` field), never a full delete-and-replace. DEFAULT-ON per
  // Grace's "always flag on" policy (ENG-1279) — off → the legacy one-off list
  // (explicit "Generate Shopping List" only; kill switch: remove here / PostHog).
  // Web + mobile — keep in sync with apps/mobile/lib/analytics.ts.
  "plan_shopping_sync_v1",
  // ENG-722 — log-confirm checkmark micro-animation (Noom teardown element D):
  // a calm sage check scale-fades over the Today ring on every successful log
  // (visual half; the light commit haptic shipped 2026-04-28). DEFAULT-ON per
  // the "always flag on" beta-window policy; off → no animation (kill switch).
  // Reduce-motion → no check. Web + mobile — keep in sync with analytics.ts.
  "log_confirm_check_v1",
  // ENG-713 — the opt-in body-neutral "Trend-only weight" Settings toggle (ED +
  // dysphoria dignity). DEFAULT-ON per the "always flag on" beta-window policy,
  // but the FLAG only controls whether the opt-in TOGGLE exists — the FEATURE
  // itself is opt-in (the client-side pref defaults OFF, so no behaviour changes
  // until the user flips it). Off → the toggle is hidden and Progress renders
  // exactly as today (kill switch: remove here / PostHog). The pref reuses the
  // T13 `trends_only` render path (no new weight-surface fork). Web + mobile —
  // keep in sync with apps/mobile/lib/analytics.ts.
  //
  // COPY GATE: the neutral trend strings in
  // `src/lib/preferences/trendOnlyWeight.ts` need diversity-inclusion +
  // legal-reviewer sign-off before this ramps beyond the solo tester (see
  // docs/decisions/2026-07-01-trend-only-weight-mode.md).
  "progress_trend_only_v1",
  // ENG-1283 — import review honesty: when a URL/social import leaves ≥1
  // ingredient flagged (below the 0.55 confidence floor / quantity-less /
  // unverified) or has no usable macro spine, the review surfaces a calm
  // "N of M ingredients need review — the macro total may be incomplete." line
  // + marks the affected rows, instead of a silent under-counted success.
  // Derives from the SHARED importQualitySignal predicate (no recompute; no
  // parser / floor / legal / persistence change). DEFAULT-ON per the "always
  // flag on" beta-window policy; off → today's silent-success render exactly
  // (kill switch: remove here / PostHog). Web + mobile — keep in sync with
  // apps/mobile/lib/analytics.ts.
  "import_review_flagged_ingredients_v1",
  // ENG-1233/1241 — onboarding conversion funnel: the guided first-log
  // activation step (ENG-1233) then the optional, skippable "See Pro"
  // trial ask (ENG-1241, TERMINAL — skip lands straight on Today). Runs
  // first-log → upgrade after data-bridges. Default-ON per the beta-window
  // house rule (Grace is the N=1 tester); OFF → data-bridges stays terminal
  // (legacy flow, byte-identical). This IS the flag the ENG-1241 brief
  // called "onboarding-see-pro" — reused rather than renamed to avoid
  // breaking the live PostHog funnel dashboards keyed on it. Keep in sync
  // with apps/mobile/lib/analytics.ts + GATE_15_SHARED in
  // tests/unit/redesignDefaultOnParity.test.ts.
  "onboarding_conversion_funnel_v1",
  // ENG-974 — "Refine by describing" conversational correction on photo +
  // voice log review (docs/decisions/2026-07-01-log-refine-by-describing.md
  // ratified it Shipped default-ON, but the flag was never added here, so it
  // sat dark — ENG-1302 closed the gap). Off → hosts render their legacy
  // review without the refine input (kill switch: remove here / PostHog).
  // Web + mobile — keep in sync with apps/mobile/lib/analytics.ts.
  "log_refine_describe_v1",
  // ENG-1303 — the v3 method-grid TILE grammar for the LogSheet input-method
  // row (rounded secondary-surface tiles: Scan / Photo / Voice / Describe /
  // Quick add, frost lock badge in place of the "PRO" text pill) + the sheet
  // header copy "Add to today" (was "Log a meal"). Describe is a first-class
  // tile that expands the inline describe flow. DEFAULT-ON per the beta-window
  // "always flag on" policy (Grace 2026-07-02) — off → the legacy circular
  // input chips + "Log a meal" header render byte-for-byte (kill switch:
  // remove here / PostHog). Web + mobile — keep in sync with
  // apps/mobile/lib/analytics.ts.
  "sloe_v3_log",
]);

/**
 * Default-OFF flags — registered for discoverability only. A flag here is
 * NOT in `REDESIGN_DEFAULT_ON`, so `isFeatureEnabled` resolves it `false`
 * until PostHog ramps it (the safe dark default for a NEW surface not yet
 * validated in sim). Keep in sync with the same block in
 * `apps/mobile/lib/analytics.ts`.
 *
 * - `logsheet_ai_method_tooltip` (ENG-1252) — first-session inline tooltip
 *   ("AI logging — available with Pro.") under the locked Voice / Snap chip
 *   in the LogSheet `InputModeRow`, free-tier, first ~3 sessions. Gate logic:
 *   `src/lib/today/aiMethodTooltip.ts`.
 * - `progress_milestone_celebration_v1` (ENG-952) — quiet two-tier milestone
 *   celebration crossing the 10 Happy-Scale-style milestones. Web + mobile.
 * - `onboarding_progressive_text` (ENG-720) — word/clause-staggered text reveal
 *   on the two onboarding "moment" beats (Welcome wordmark+tagline, Reveal
 *   "Your plan is ready." heading). Each token fades + rises a few px,
 *   staggered by `PROGRESSIVE_TEXT_STAGGER_MS` (`@suppr/shared/motion`). Flag-OFF
 *   or reduce-motion → instant text (zero visual change). Component:
 *   `ProgressiveText` (web + mobile). Web + mobile.
 * - `onboarding-why-now` (ENG-963) — the optional "What's bringing you here?"
 *   onboarding step (placed after `goal`). DEFAULT-OFF: when OFF both flow
 *   shells auto-skip the step (same mechanism as `onboarding-app-choice`)
 *   and drop it from the step counter, so the live flow is unchanged and the
 *   change is mergeable headless. Grace ramps it in PostHog after a sim + web
 *   glance at the new step's pixels. Web + mobile.
 *
 * Moved to `REDESIGN_DEFAULT_ON` (default-ON) — see their entries there:
 * `expenditure_trend_card` (ENG-953); the "always flag on" batch (ENG-1279,
 * 2026-06-30): `progress_plateau_insight_v1` (ENG-954), `weigh_in_reminder_v1`
 * (ENG-955), `portion_fit_hint_v1` (ENG-854); and `import_magic_moment`
 * (ENG-728) + `paywall_trajectory_chart_v1` (ENG-969).
 */
export const KNOWN_DEFAULT_OFF_FLAGS = [
  "logsheet_ai_method_tooltip",
  "progress_milestone_celebration_v1",
  "onboarding_progressive_text",
  "onboarding-why-now",
  "trial_end_reminder_v1", // ENG-968 — Duolingo-style trial-end reminder day picker
  "recipe_yield_portion_v1", // ENG-736 — structured recipe yield + portion-style logging
] as const;

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
