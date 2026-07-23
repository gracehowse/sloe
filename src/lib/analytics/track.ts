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
 * (ENG-1651 round 2, 2026-07-22 — `reveal-macro-tile-paired-pct` removed
 *  from this list and collapsed to its permanently-on branch in
 *  `src/app/components/onboarding/steps/reveal.tsx`. PostHog confirmed it
 *  had been at a genuine, untouched 100% rollout since 2026-05-16 — this
 *  block's prior "DEFAULT-OFF by design" note for it was stale and
 *  actively wrong.)
 *
 * - `recipe_verdict_chip_v1` (ENG-1612) — recipe-detail "Fits your day"
 *   verdict as a prototype-scale inline soft pill instead of the ENG-1085
 *   confident SOLID full-width banner. DEFAULT-OFF: no device/sim
 *   validation landed in this change (see
 *   docs/decisions/2026-07-19-fits-your-day-verdict-chip.md); flag-off keeps
 *   the SOLID banner as the kill switch. Keep in sync with mobile.
 * - `streak_pip_zero_day_web_v1` (ENG-1657) — web Today date header
 *   shows the streak pip at 0-day (mobile calm-streak posture). DEFAULT-OFF:
 *   flag-off keeps the legacy ≥2-day mount gate in `today-date-header.tsx`;
 *   flag-on mounts the pip for any non-negative streak count. WEB-ONLY in
 *   practice (mobile already always renders the pip when mounted). Keep in
 *   sync with apps/mobile/lib/analytics.ts registry.
 * - `avatar_monogram_frost_ring_v1` (ENG-1593) — the persistent user/
 *   household identity monogram (sidebar, Today header, Profile identity
 *   card) in Rule 7's serif-initial + frost-ring treatment
 *   (`docs/ux/redesign/v3/DESIGN-CONSTITUTION.md` Rule 7). The canonical
 *   damson fill (`--avatar-identity`) was already unified across every
 *   `AvatarDisc` call site by the S5 ruling (2026-07-10, ENG-1375) — this
 *   flag only adds the serif + ring, no fill change on web. DEFAULT-OFF:
 *   this is app-wide chrome and no device/sim visual pass landed in this
 *   change. Flag-off keeps every monogram render byte-identical as the
 *   kill switch. Keep in sync with mobile.
 * - `recipe_estimated_cost_v1` (ENG-1274) — per-serving grocery cost estimate
 *   in the v3 recipe-detail hero meta row (Pro signal; static UK reference
 *   prices, honest range). DEFAULT-OFF until Grace ramps in PostHog after a
 *   web + mobile glance. Keep in sync with mobile.
 *
 * (The 5 cook-mode flags moved to `REDESIGN_DEFAULT_ON` in the 2026-06-22
 *  flag-collapse sweep, after the ENG-1230 swipe-surface render bug was fixed
 *  — the v3 cook baseline is now default-on. `today_desktop_frame_v1` moved
 *  there 2026-07-10 after the ENG-1495 single-rail rework fixed the
 *  device-validation failures that had kept it dark — see its entry in the
 *  set.)
 */

/** Redesign 2026 flag set — the new design is the DEFAULT in every build
 *  (Grace 2026-06-01: "turn everything on; never flag-gate again"). These
 *  resolve ON regardless of PostHog rollout state; the PostHog rows survive
 *  only as emergency kill switches via `isFeatureDisabled`. An explicit
 *  dev/test force (above) still wins, so pre-redesign captures keep working.
 *  Keep in sync with the same set in `apps/mobile/lib/analytics.ts`. */
const REDESIGN_DEFAULT_ON = new Set<string>([
  // ENG-1464 — trust chips/dots show the source name ("USDA") instead of the
  // "USDA verified" over-promise. Default-ON (N=1 tester); flag-off keeps the
  // legacy "USDA verified" copy (kill switch). Keep in sync with mobile.
  "trust_source_name_v1",
  // ENG-1422 — Plan Import review surfaces the count of ingredient lines left
  // out of the Sloe-calc totals ("N low-confidence lines left out — review
  // before importing"). Trust/safety fix (the old tier was an inverted signal),
  // so it ships DEFAULT-ON at N=1 with the PostHog row as the kill switch; flag
  // off hides the count line (the tier cap itself is unflagged server logic).
  // Keep in sync with mobile.
  "plan_import_excluded_lines_v1",
  // ENG-1527 — the shopping-list "Update from plan" re-sync affordance
  // (mobile + web). Default-ON so the dead-end fix ships everywhere; the
  // PostHog gate is the kill switch for the non-destructive DB write path.
  "shopping_update_from_plan_v1",
  // ENG-1669 — in-store shopping-list density (hide recipe paragraphs, strip
  // prep from labels, shop-sensible qty, thin progress, less chrome spam).
  // Default-ON; PostHog row is the kill switch. Keep in sync with mobile.
  "shopping_list_density_v1",
  // Device-validated 2026-07-07 (device-verify2 pass, 4/4 verbatim contract
  // match) + Fable lens review on ENG-1454's under-eating string — flipped
  // per the growth-builds-default-ON convention.
  "empty_state_grammar_v1", // ENG-1372 slice 1 — Today fresh-day ring + Plan empty week
  "coaching_stages_v1", // ENG-1454 — staged coach copy + broken-streak recap grace

  // Device-validated 2026-07-07 (device-verify2 pass, 4/4 verbatim contract
  // match) + Fable lens review on ENG-1454's under-eating string — flipped
  // per the growth-builds-default-ON convention.

  "redesign_motion",
  "today-weekly-insight-mobile",
  "today_meals_figma_654",
  // ENG-1642 — the real shareable meal-link create/accept flow. DEFAULT-ON
  // per Grace's ship-on-for-sim-validation practice (2026-07-21): the flag
  // gates link CREATION only, so on = the "Share meal" kebab mints a
  // `/m/<token>` link she can validate in TestFlight; off (kill switch) =
  // legacy text-only share. Redemption is un-gated regardless (see the
  // KNOWN_DEFAULT_OFF_FLAGS bullet, kept as the moved-flag record). The anon
  // `get_meal_share` surface is live post-migration independent of this flag,
  // and was security-reviewed + live-verified (ENG-1650) before the flip.
  "meal_share_links_v1",
  // ENG-1634 — shopping-list "Smart suggestions" (overlap + remaining-macro
  // fit, Add to plan via ENG-957). MOVED to REDESIGN_DEFAULT_ON 2026-07-22
  // (Grace ship-on): PostHog row also at 100% as the kill switch / ramp
  // control. Off → section hidden. Keep in sync with mobile.
  "smart_suggestions_v1",
  // ENG-1662 — anatomy owner components (SupprNotice, IconButton, CountBadge)
  // + AddRow left-align panel form + first notice migration (NorthStar
  // library-empty). DEFAULT-ON for sim validation; off restores the legacy
  // radius-8 hand-rolled notice + centred AddRow (kill switch). Keep in sync
  // with apps/mobile/lib/analytics.ts.
  "ui_anatomy_owners_v1",
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
  // ENG-978/979 — shareable import-success card + creator credit in share text.
  // Default-on; off → legacy title+URL share only.
  "recipe_share_card_v1",
  // ENG-972 — inline NL text meal logging inside LogSheet (default-on).
  "log_sheet_nl_text_v1",
  // ENG-980 — save-first import lands in Library before review (mobile import).
  "import-save-first-v1",
  // ENG-848 — web Today macro tiles/bars open MacroDetailPanel. Web-only:
  // mobile already has the native `macro-detail` route wired from Today.
  "web_macro_detail_panel",
  // ENG-901 — Figma `284:2` inline trust row (· separators, Lock/Calendar
  // glyphs) instead of pill chips on paywall/pricing. Default-on; off → pills.
  "paywall_trust_inline_v1",
  // ENG-901 — web upgrade dialog Sloe Pro hero + inline trust strip. Default-on.
  "paywall_upgrade_dialog_sloe_v1",
  // ENG-1203 — merchandise the free MFP-switch wins (barcode scanning + custom
  // macros) on the landing Free column + paywall comparison matrix. Default-on;
  // off → the legacy copy without the two free callouts.
  "paywall_free_mfp_wins_v1",
  // ENG-1225 Block 6 — the v3 Discover editorial sections (Quick weeknight
  // no-photo cards + Collections). Default-on; off → the legacy feed without
  // those sections (kill switch). Mobile + web.
  "sloe_v3_discover_editorial",
  // ENG-1618 — photographic Discover first viewport. Quick Weeknight uses
  // each recipe's real media and moves ahead of the creator/filter/import
  // chrome on mobile-web. Default-on for the beta-window fix; off preserves
  // the exact tint-card ordering as the kill switch. Mobile + web.
  "discover_photographic_first_view_v1",
  // ENG-1225 #14 — the v3 Discover creator plane (creator rail + web featured
  // hero + mobile Following feed). RAMPED ON 2026-06-24 (ENG-1247, Grace's
  // call). ENG-1535 removed the invented launch personas; the rail now
  // self-hides until the RPC returns genuine creators. Off → legacy feed. M+W.
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
  // ENG-1247 blocker (2026-07-10): the ENG-1264 default-ON flip missed this
  // flag on web — mobile has had it since (apps/mobile/lib/analytics.ts); web
  // Plan rendered the LEGACY surface for flag-cold users.
  "sloe_v3_plan",
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
  // ENG-1461 — jargon-gloss system (ENG-1187): TDEE/BMR renders lead with
  // plain English ("Est. daily burn (TDEE)"), acronym secondary. DECIDED
  // (Fable, 2026-07-07, per Grace's delegation) to flip ON and extend beyond
  // onboarding to Progress + pricing + the weekly check-in. Off → the plain
  // (pre-gloss) label at each site — never a broken render, so still a safe
  // kill switch. Web + mobile — keep in sync with apps/mobile/lib/analytics.ts.
  "onboarding_jargon_gloss_v1",
  // ENG-1460 — /pricing conversion pair (2026-07-05 critique, DECIDED Fable
  // 2026-07-07): hero billing selector + ONE filled "Start free trial" CTA
  // in the first viewport (`PricingHeroCta`), tier-card CTAs demoted to
  // outline so they don't compete, and the header reflects auth state
  // (avatar/account instead of "Sign in" for signed-in visitors,
  // `PricingHeaderAuth`). WEB-ONLY (mobile paywall already has a persistent
  // CTA + never shows a wrong-identity header). Off → the pre-ENG-1460
  // "Sign in" header + tier cards five sections deep with no early CTA
  // (kill switch).
  "pricing_conversion_pair_v1",
  // ENG-1495 (2026-07-10) — desktop Today frame (ENG-1494 wiring), rebuilt
  // SINGLE-RAIL and flipped default-ON once conformance was met: the frame
  // adds only chrome (breadcrumb + slim household glance bar fed by
  // HouseholdContext) above the tracker and appends the null-unless-data
  // Apple Health card into the tracker's OWN right rail via `railExtra` —
  // no second grid (the ENG-1494 outer grid squeezed the hero to ~316px),
  // no above-the-hero HouseholdPanel (which pushed the ring ~1100px below
  // the fold), no duplicate Weekly Insight (the tracker's THIS WEEK card
  // covers it). WEB-ONLY — a >=lg desktop layout; mobile has no equivalent
  // surface. Off → the direct `<NutritionTracker>` render in App.tsx
  // (kill switch).
  "today_desktop_frame_v1",
  // ENG-1532 — component-grammar dedup: sub-tab switchers (Recipes
  // Cookbook/Discover, Plan This week/Shopping) render the §8 SegmentedTrack
  // pill (Shopping keeps its count badge via the new SegmentedTrack badge
  // option) instead of the SubTabPill underline tabs; plus the one-search-row
  // grammar and single barcode entry point. Default-ON per the beta-window
  // "always flag on" policy (N=1 tester); flag-off renders every gated
  // surface byte-intact — SubTabPill underline tabs, carded BEST MATCHES,
  // scan tile + search-row scanner icons (kill switch: remove here /
  // PostHog). Web + mobile — keep in sync with apps/mobile/lib/analytics.ts.
  "component_grammar_dedup",
  // ENG-1438 (2026-07-05 deep audit, MP-06/LEGAL-006) — condensed one-line
  // auto-renewal disclosure directly under the always-visible sticky/hero
  // purchase CTA (`buildStickyRenewalLine` in `src/lib/landing/paywallTrust.ts`).
  // Pre-fix the full disclosure sat below the fold while the CTA was visible
  // from frame one, so a user could tap purchase without ever reading it.
  // Legal-reviewed copy; shared web + mobile. Off → the pre-fix caption
  // (kill switch).
  "paywall_sticky_renewal_line_v1",
  // ENG-1643 — LogSheet stays open after each immediate-commit add + a
  // session tray receipt (count/kcal/per-item Undo/Save-as-usual-meal/Done)
  // instead of the S13 confirmation closing the sheet. Default-ON per the
  // beta-window "always flag on" policy (N=1 tester); web verified via
  // Storybook pixel capture (all four tray states), mobile unverified on
  // device/sim (ENG-1654 blocks local iOS builds) but structurally identical
  // to web and covered by logSheetWebMobileParity.test.ts — the PostHog row
  // is the kill switch if mobile misbehaves. Off → S13 card closes the sheet
  // (kill switch). Web + mobile — keep in sync with apps/mobile/lib/analytics.ts.
  "log_session_tray_v1",
  // Whole-app font-family + size consistency gate: adopts `.card-hero-value`
  // (36px serif, one card-payoff numeral tier below the ring's own centre
  // value) and the rest of the type ladder on card-hero / stat-tile numerals +
  // CTA labels that currently render off-ramp or larger than the ring's own
  // centre value. DEFAULT-ON per the beta-window "always flag on" policy; off →
  // every gated surface keeps its exact pre-existing font size/family (kill
  // switch). No Linear ticket yet — file one before flag cleanup. Keep in sync
  // with apps/mobile/lib/analytics.ts.
  "type_scale_v1",
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
 *   shells auto-skip the step (the same resolveNextStep/auto-skip mechanism
 *   `onboarding-app-choice` used before it collapsed, ENG-1651)
 *   and drop it from the step counter, so the live flow is unchanged and the
 *   change is mergeable headless. Grace ramps it in PostHog after a sim + web
 *   glance at the new step's pixels. Web + mobile.
 * - `empty_state_grammar_v1` (ENG-1372, slice 1) — the first-week empty-state
 *   grammar contract: Today ring fresh-day (warm-tint empty track, time-aware
 *   "Log breakfast/lunch/dinner" pill inside the hero, BONUS stat cell
 *   suppressed at 0) + Plan empty-week (warm invitation card replaces the
 *   dashed-box wall + zero-triad). MOVED to `REDESIGN_DEFAULT_ON` 2026-07-07
 *   after the device-verify2 pass (4/4 verbatim). Off → legacy treatment
 *   exactly (kill switch). Web + mobile.
 * - `coaching_stages_v1` (ENG-1454, 2026-07-06 Fable-day failure-moment
 *   judgment) — staged over/under-budget Today coach line (approaching
 *   85-100% / landed 100-110% / over 110-140% / big >140% of goal — see
 *   `src/lib/nutrition/coachOverBudgetStage.ts`), the neutral net-energy
 *   "Net energy today: +{n} kcal" reframe (replaces the 2nd-person "you've
 *   eaten N more than you've burned" accusation), the two ED-safe
 *   under-eating nudges, and the weekly-recap broken-streak grace rewrite
 *   (achievement-led headline, one-clause reset, streak-freeze mechanic
 *   surfaced at the break, protein digest line). MOVED to
 *   `REDESIGN_DEFAULT_ON` 2026-07-07: device-verify2 matched every contract
 *   string verbatim, and the wired under-eating string passed the
 *   diversity-inclusion + nutrition-engine lens review (on ENG-1454). Off →
 *   every gated surface renders its exact pre-ENG-1454 copy (kill switch). Web +
 *   mobile.
 * - `paywall_fallback_when_unavailable` (ENG-1381) — when RC offerings fail
 *   to load (`subscriptionsUnavailable`), the mobile paywall renders the plan
 *   selector + auto-renew disclosure with FALLBACK_PRICES + an
 *   indicative-price caveat instead of a stateless "Open App Store" screen.
 *   DEFAULT-OFF — enable only after legal (CMA disclosure w/ indicative
 *   price) + design review. Registered here only for the web ↔ mobile
 *   KNOWN_DEFAULT_OFF_FLAGS parity check — the flag is mobile-only in
 *   practice (the RevenueCat `subscriptionsUnavailable` state is
 *   native-IAP-specific; web billing is Stripe), so no web code reads it.
 * - `kcal_trust_qualifier_v1` (ENG-1417) — a "~" prefix on kcal displays
 *   that are an unverified estimate rather than a verified nutrition
 *   lookup (`recipes.is_verified`), on decision-driving surfaces only:
 *   the north-star suggestion card, meal planner day totals, Cook Mode,
 *   and Discover's calorie sort — NOT on browse-level recipe cards
 *   (Discover grids, Library editorial shelves), which a prior audit
 *   (2026-04-28, GW-08) found read as decorative noise. DEFAULT-OFF: net
 *   new, not yet sim-validated — Grace ramps in PostHog after a web +
 *   mobile glance. Off → all gated surfaces render their exact
 *   pre-ENG-1417 kcal display (kill switch). Web + mobile.
 * - `discover_verified_filter_v1` (ENG-1417) — a "Verified only" filter
 *   chip on web Discover, wiring the previously-dead `filters.verified`
 *   state (it existed and was checked, but no control ever set it).
 *   DEFAULT-OFF: net new structural control, not yet sim-validated.
 *   Registered here only for the web ↔ mobile KNOWN_DEFAULT_OFF_FLAGS
 *   parity check — the flag is web-only in practice (mobile Discover has
 *   no equivalent filter sheet), so no mobile code reads it.
 * - `energy_numbers_v1` (ENG-1506/1507) — the canonical energy-numbers
 *   reconciliation: every maintenance surface reads `selectMaintenance`
 *   (one input policy — latest weigh-in, strict-null basics), Targets +
 *   Expenditure stop bypassing the resolver, the net-energy "maintenance"
 *   state word becomes "Balanced", and empty todays show an empty state
 *   instead of "0 kcal maintenance". DEFAULT-OFF: real users' displayed
 *   maintenance MOVES when this ramps (the intended convergence) — Grace
 *   ramps in PostHog with before/after screenshots per
 *   `docs/decisions/2026-07-11-canonical-energy-numbers.md`. Off → every
 *   surface renders its exact pre-ENG-1506 numbers AND no write path
 *   adopts the new input policy — the goal-editor recompute baseline,
 *   daily-target snapshot/backfill inputs, and the projection
 *   goal-vocabulary fallback are all host-gated on this flag (kill
 *   switch; re-verified 2026-07-11 review round). The server weekly-recap
 *   push route can't read the flag and stays fully legacy until
 *   flag-collapse. W + M.
 * - `referral_invite_loop_v1` (ENG-1236) — the referral / invite-for-Pro
 *   growth loop card in the household invite surfaces. MOVED to DEFAULT-OFF
 *   2026-07-12 (ENG-1541): the card + landing page (`ReferralRewardCard`,
 *   `app/g/[code]/ReferralLandingClient`) publicly PROMISE "30 days of Pro"
 *   for a referral, but no entitlement-grant path exists yet (needs a
 *   purchase rail). Shipping it on made an unkeepable promise. Keep OFF
 *   until the grant is wired; off → the referral card is hidden and the
 *   existing household invite flow is unchanged. Web + mobile.
 * - `progress_hierarchy_v1` (ENG-1525) — the Progress tab 5-section
 *   hierarchy rebuild (Trajectory hero → This Week → Energy → Body
 *   composition → Your Week) replacing the legacy 13-card stack.
 *   DEFAULT-OFF: a full-surface structural change (the energy_numbers_v1
 *   precedent, not the "always flag on" additive-card one) — Grace ramps
 *   in PostHog with before/after screenshots. Off → the legacy 13-card
 *   stack renders exactly as before (kill switch). Both hosts read the
 *   flag ONCE on mount into state so the layout never flips mid-session.
 *   Keep in sync with `apps/mobile/lib/analytics.ts`. Web + mobile.
 * - `web_gutter_convergence_v1` (ENG-1629) — converges the three-way page-
 *   gutter split on web core screens (`.product-shell`'s 40px `px-pm-6`
 *   dominant convention vs `Targets.tsx`'s 32px `px-pm-5` vs
 *   `RecipeDetail.tsx`'s un-tokenized 24px `px-6`) onto `.product-shell`'s
 *   composition everywhere. DEFAULT-OFF: RecipeDetail is a named visual-
 *   regression cohesion-gate surface (ENG-1142) on the launch-critical
 *   Recipes tab — same "ship dark for Grace's own glance" posture as this
 *   file's three other recipe-detail-touching flags (`recipe_verdict_chip_v1`,
 *   `avatar_monogram_frost_ring_v1`, `recipe_estimated_cost_v1`), not the
 *   "always flag on" additive-card convention. Off → both screens render
 *   their exact pre-ENG-1629 gutter (kill switch). The e2e cohesion suite
 *   force-flags this ON (`tests/e2e/utils/visual.ts` REDESIGN_VISUAL_FLAGS)
 *   so the committed `deep-recipe-detail-*.png`/`deep-targets-*.png`
 *   baselines show the converged state ready for the PostHog ramp.
 *   WEB-ONLY — mobile has no Tailwind `.product-shell` equivalent (its own
 *   `Spacing` ramp has no analogous 3-way split); registered on mobile only
 *   for the web ↔ mobile `KNOWN_DEFAULT_OFF_FLAGS` discoverability parity.
 *
 * Moved to `REDESIGN_DEFAULT_ON` (default-ON) — see their entries there:
 * `expenditure_trend_card` (ENG-953); the "always flag on" batch (ENG-1279,
 * 2026-06-30): `progress_plateau_insight_v1` (ENG-954), `weigh_in_reminder_v1`
 * (ENG-955), `portion_fit_hint_v1` (ENG-854); and `import_magic_moment`
 * (ENG-728) + `paywall_trajectory_chart_v1` (ENG-969).
 *
 * - `meal_share_links_v1` (ENG-1642) — the real shareable meal-link flow
 *   (`create_meal_share` / `get_meal_share` RPCs, `/m/<token>` accept
 *   surface) replacing the title+text-only `navigator.share`/clipboard
 *   path on the per-meal kebab "Share meal" action. **Gates CREATION
 *   only** — OFF means the host passes no link-creating callback to
 *   `TodayMealsSection`, so the row falls back to the legacy
 *   text-only share/copy path untouched, and no *new* link can be
 *   minted. Redemption (the `/m/<token>` web landing, the `/home`
 *   `?mealShare=`/pending-share resume, and mobile's `/meal-shared`
 *   accept screen) is **deliberately un-gated on both platforms**,
 *   flag on or off — partial-ramp safety (a link minted inside a ramp
 *   cohort must still resolve for a recipient outside it) and
 *   web↔mobile parity (see the doc comment on `SharedMealAcceptHost`,
 *   `src/app/components/suppr/shared-meal-accept-host.tsx`, and
 *   mobile's `/meal-shared` route). This is why gating the flag OFF is
 *   not a security kill of redemption — a previously-shared token
 *   still resolves via the anon-executable `get_meal_share` RPC
 *   regardless of the flag. A true kill of redemption requires a
 *   follow-up migration that revokes the anon grant on
 *   `get_meal_share`. **MOVED to `REDESIGN_DEFAULT_ON` 2026-07-22**
 *   (Grace's ship-on-for-sim-validation practice): the anon surface was
 *   security-reviewed + live-verified under ENG-1650 (RPC 17/17 + web
 *   e2e + iOS-sim accept-screen render) before the flip, so the flag
 *   ships ON as a kill switch rather than a dark 0% gate. Bullet kept
 *   here as the moved-flag record. Keep in sync with
 *   `apps/mobile/lib/analytics.ts`.
 *
 * - `type_scale_v1` — the whole-app font-family + size consistency gate
 *   (`.card-hero-value` + the rest of the type ladder on card-hero /
 *   stat-tile numerals + CTA labels that render off-ramp or larger than the
 *   ring's centre value). MOVED to `REDESIGN_DEFAULT_ON` 2026-07-22
 *   (ship-on-for-sim practice); off keeps every gated surface's exact
 *   pre-existing size/family (kill switch). No Linear ticket yet — file one
 *   before flag cleanup. Keep in sync with `apps/mobile/lib/analytics.ts`.
 */
export const KNOWN_DEFAULT_OFF_FLAGS = [
  "logsheet_ai_method_tooltip",
  "progress_milestone_celebration_v1",
  "onboarding_progressive_text",
  "onboarding-why-now",
  "trial_end_reminder_v1", // ENG-968 — Duolingo-style trial-end reminder day picker
  "recipe_yield_portion_v1", // ENG-736 — structured recipe yield + portion-style logging
  "paywall_fallback_when_unavailable", // ENG-1381 — priced fallback for RC-unavailable paywall (mobile-only in practice)
  "kcal_trust_qualifier_v1", // ENG-1417 — "~" qualifier on unverified kcal, decision surfaces only
  "discover_verified_filter_v1", // ENG-1417 — Discover "Verified only" filter chip (web-only in practice)
  "energy_numbers_v1", // ENG-1506/1507 — canonical energy numbers (selectMaintenance input policy + qualifiers)
  "referral_invite_loop_v1", // ENG-1541 — OFF until Pro-days entitlement grant is wired (unkeepable promise)
  "mobile_preauth_reveal_v1", // ENG-1513 — MOBILE-ONLY (pre-auth onboarding reveal). Registered here only for the web↔mobile KNOWN_DEFAULT_OFF_FLAGS parity check; web already runs pre-auth (ENG-962).
  "plan_alert_to_toast_v1", // ENG-1344 first slice — planner.tsx's 7 non-blocking Alert.alert calls migrate to the shared Toast primitive; else = legacy Alert.alert (unchanged). MOBILE-ONLY: web has no Alert.alert-as-toast pattern to migrate (already native sonner). Registered here only for the web↔mobile KNOWN_DEFAULT_OFF_FLAGS parity check.
  "ingredient_text_rows_v1", // ENG-1611 — foods/ingredients render as TEXT (no glyph/monogram/photo tiles) on log-sheet rows + recipe-detail ingredients; off = legacy tiles (kill switch). Web + mobile.
  "progress_hierarchy_v1", // ENG-1525 — Progress 5-section hierarchy; else = legacy 13-card stack (kill switch). Keep in sync with apps/mobile/lib/analytics.ts.
  "primary_screen_chrome_v1", // ENG-1577 — 33px title + 40px muted-circle actions; Today remains the exception.
  "bottom_chrome_contract_v1", // ENG-1376 — measured floating-bar clearance + Settings viewport ownership.
  "recipe_sparse_media_v1", // ENG-1575 — 0/1/2/many Library composition + one recipe fallback policy.
  "recipe_placeholder_identity_v1", // ENG-1667 — layer-2 deterministic placeholder identity: larger hero glyph scale (web + mobile).
  "semantic_stat_roles_v1", // ENG-1578 — sibling stats stay ink; state lives in sanctioned indicators.
  "library_single_filter_row_v1", // ENG-1607 — Cookbook single provenance chip row (v3); off = legacy two-row stack (kill switch). Web + mobile.
  "recipe_estimated_cost_v1", // ENG-1274 — per-serving grocery cost estimate (Pro) on recipe-detail hero meta; off = hidden (kill switch). Web + mobile.
  "web_gutter_convergence_v1", // ENG-1629 — converge Targets.tsx (px-pm-5) + RecipeDetail.tsx (px-6/max-w-4xl) onto .product-shell's gutter; off = exact pre-ENG-1629 gutters (kill switch). WEB-ONLY.
  "onboarding_terminal_paywall_v1", // ENG-1459 — terminal onboarding is the full paywall (no stacked trial ask); off = legacy trial page + dialog/route (kill switch). Web + mobile.
  "today_hero_cluster_v3", // ENG-1653 — tight v3 hero cluster (8/20/4 wordmark→greeting→strip→dial rhythm), Coach chip de-orphaned to the hero foot, north-star "eat next" directly under the hero (prototype order); off = legacy flat-24 composition (kill switch). Web + mobile.
  "today_section_rhythm_v1", // ENG-1655 — two-tier section rhythm (within 8–12, between-section 24); off = flat Spacing.xl scroll gap (kill switch). Web + mobile.
  "today_hero_macro_legend_v1", // ENG-1656 — macro legend in hero foot + force bars detail band; off = legacy Tiles/Bars/Rings pref (kill switch). Web + mobile.
  // `smart_suggestions_v1` (ENG-1634) — MOVED to REDESIGN_DEFAULT_ON 2026-07-22.
  "meal_share_manage_v1", // ENG-1648 — Settings "My shared links" list + revoke; off = section hidden (kill switch). Web + mobile.
  "in_app_help_import_v1", // ENG-1597 — contextual "?" hints on Import→Verify→Save; off = hidden (kill switch). Web + mobile.
  "today_date_header_serif_v1", // ENG-1505 — MOBILE-ONLY: compact date-header title serif-24 (Type.title); web already ships serif-24 un-gated. Registered here for KNOWN_DEFAULT_OFF_FLAGS parity. Keep in sync with apps/mobile/lib/analytics.ts.
  "streak_pip_zero_day_web_v1", // ENG-1657 — web Today header shows streak pip at 0-day (mobile parity); off = legacy ≥2-day gate (kill switch). WEB-ONLY. Keep in sync with apps/mobile/lib/analytics.ts.
  "ui_anatomy_owners_v1", // ENG-1665 — Plan-first anatomy owner migrations (SheetShell, CountBadge, StepperCircleButton on Plan surfaces); off = legacy hand-rolled chrome (kill switch). Web + mobile.
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
