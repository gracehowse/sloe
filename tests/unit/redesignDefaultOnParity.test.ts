/**
 * REDESIGN_DEFAULT_ON — web ↔ mobile parity (Gate 1.5 prod verify).
 *
 * Grace 2026-06-01: redesign flags default ON in every build. The two SSOT
 * sets in `src/lib/analytics/track.ts` and `apps/mobile/lib/analytics.ts`
 * must stay in sync for shared flags; platform-only flags are documented.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const WEB_TRACK = readFileSync(resolve(ROOT, "src/lib/analytics/track.ts"), "utf8");
const MOBILE_ANALYTICS = readFileSync(
  resolve(ROOT, "apps/mobile/lib/analytics.ts"),
  "utf8",
);

/** Parse `"flag_name"` entries from a `REDESIGN_DEFAULT_ON = new Set<string>([...])` block. */
function parseRedesignDefaultOn(src: string): Set<string> {
  const start = src.indexOf("REDESIGN_DEFAULT_ON = new Set<string>([");
  expect(start, "REDESIGN_DEFAULT_ON block").toBeGreaterThanOrEqual(0);
  const open = src.indexOf("[", start);
  const close = src.indexOf("]);", open);
  expect(close).toBeGreaterThan(open);
  const body = src.slice(open + 1, close);
  const flags = new Set<string>();
  for (const m of body.matchAll(/"([a-z0-9_-]+)"/g)) {
    flags.add(m[1]);
  }
  return flags;
}

/** Platform-specific flags — intentionally present on one side only. */
const WEB_ONLY = new Set([
  // ENG-1089 — carousel order fix; mobile Discover has no carousel branch.
  "discover_import_above_carousels_v1",
  // ENG-1095 — web Today always renders four slots (mobile already does).
  "today_meals_all_slots_v1",
  // ENG-1092 increment 3 — web Plan config collapse (mobile already collapsed).
  "plan_adjust_collapsed_v1",
  // ENG-848 — web Today opens MacroDetailPanel; mobile already routes to macro-detail.
  "web_macro_detail_panel",
  // ENG-901 — web upgrade dialog Sloe hero; mobile paywall is a separate surface.
  "paywall_upgrade_dialog_sloe_v1",
  // ENG-1225 flag-collapse sweep (2026-06-22) — the v3 Progress refinements
  // are web-only paths; mobile has its own native Progress surfaces.
  // (`sloe_v3_energy_equation` graduated to SHARED in Block 8 once the mobile
  //  ProgressEnergyEquation landed — see REDESIGN_DEFAULT_ON on both platforms.)
  "web_apple_health_card",
  "web_progress_weight_empty",
  // ENG-837/P5#15 — web per-meal/slot nutrition detail; mobile already ships
  // the native `meal-nutrition` route, so this flag is web-only by design.
  "web_meal_nutrition_detail",
  // ENG-1225 #24 — web Settings two-pane layout (mobile Settings is native).
  "sloe_v3_settings",
  // ENG-1204 / D-07 — landing hero HYBRID (web-only).
  "landing_hero_hybrid_v1",
  // ENG-1460 — /pricing conversion pair (hero CTA + auth-aware header).
  // Web-only: mobile's native paywall isn't `/pricing` and already has a
  // persistent CTA bar + never shows a wrong-identity "Sign in" header.
  "pricing_conversion_pair_v1",
  // ENG-1495 — desktop Today frame (chrome + railExtra around
  // NutritionTracker at >=lg); mobile has no desktop breakpoint, so web-only.
  "today_desktop_frame_v1",
]);

const MOBILE_ONLY = new Set([
  // Skia hero ring — native-only; web uses SVG.
  "ring_skia_v1",
  // ENG-1097 — Today import nudge flat white card (iOS-only surface).
  "import_nudge_flat_white_v1",
  // ENG-898 — CreateRecipeActionSheet 2×2 grid; web has no action sheet surface.
  "create_recipe_action_sheet_grid_v1",
  // (`sloe_v3_plan` graduated to SHARED 2026-07-10 — the ENG-1264 default-ON
  //  flip had missed it on web; both platforms now list it in
  //  REDESIGN_DEFAULT_ON.)
  // ENG-1225 #22 — Progress weight "No weigh-ins yet" sparse state. Same
  // feature as web's `web_progress_weight_empty` (WEB_ONLY above); the two
  // platforms use platform-prefixed flag names, so each is listed as its own
  // platform-only entry rather than a shared flag.
  "progress_weight_empty",
  // ENG-1300 — SmartImage expo-image adoption (memory-disk cache, recycling,
  // fade). expo-image is a native module; web has no equivalent surface.
  "expo_image_adoption_v1",
  // ENG-1023 — Apple Health meal-import kill switch. HealthKit doesn't exist
  // on web, so this flag is mobile-only by construction (see
  // docs/decisions/2026-07-02-healthkit-nutrition-import-hardening.md).
  "health_nutrition_import_enabled",
]);

/** Gate 1.5 redesign surfaces that must ship default-on on both platforms. */
const GATE_15_SHARED = [
  "today_meals_figma_654",
  "plan_today_aim_empty_v1",
  "ring_empty_gradient_v1",
  "ring_empty_macro_parity_v1",
  "log-sheet-slot-selector",
  "today_log_again",
  "log_sheet_nl_text_v1",
  "recipe_share_card_v1",
  "cook_log_servings_confirm",
  "plan_web_parity_v1",
  "import-save-first-v1",
  "onboarding-app-choice",
  // ENG-1246 (Gap #16) — shared editorial Profile block, default-on both platforms.
  "sloe_v3_profile",
  // ENG-1233/1241 (Gap #15) — onboarding conversion funnel (first-log → the
  // skippable "See Pro" trial step). Default-ON both platforms per the
  // beta-window house rule; this is the flag the ENG-1241 brief called
  // "onboarding-see-pro" (reused, not renamed).
  "onboarding_conversion_funnel_v1",
  // ENG-1303 — the v3 LogSheet method-grid tile grammar + "Add to today"
  // header. Default-ON both platforms; off → the legacy circular chips +
  // "Log a meal" header (kill switch).
  "sloe_v3_log",
] as const;

describe("REDESIGN_DEFAULT_ON web ↔ mobile parity", () => {
  const web = parseRedesignDefaultOn(WEB_TRACK);
  const mobile = parseRedesignDefaultOn(MOBILE_ANALYTICS);

  it("shared flags are identical (minus documented platform-only entries)", () => {
    const webShared = [...web].filter((f) => !WEB_ONLY.has(f));
    const mobileShared = [...mobile].filter((f) => !MOBILE_ONLY.has(f));
    expect(webShared.sort()).toEqual(mobileShared.sort());
  });

  it("documents every web-only flag as absent from mobile", () => {
    for (const flag of WEB_ONLY) {
      expect(web.has(flag), `${flag} on web`).toBe(true);
      expect(mobile.has(flag), `${flag} absent on mobile`).toBe(false);
    }
  });

  it("documents every mobile-only flag as absent from web", () => {
    for (const flag of MOBILE_ONLY) {
      expect(mobile.has(flag), `${flag} on mobile`).toBe(true);
      expect(web.has(flag), `${flag} absent on web`).toBe(false);
    }
  });

  it("Gate 1.5 shared redesign flags default ON on both platforms", () => {
    for (const flag of GATE_15_SHARED) {
      expect(web.has(flag), `web.${flag}`).toBe(true);
      expect(mobile.has(flag), `mobile.${flag}`).toBe(true);
    }
  });

  it("ENG-943 recipe→shopping-list flag is default-ON + shared (web ↔ mobile)", () => {
    expect(web.has("recipe_shopping_list_v1"), "web recipe_shopping_list_v1").toBe(true);
    expect(mobile.has("recipe_shopping_list_v1"), "mobile recipe_shopping_list_v1").toBe(true);
    // It's a shared flag — not on either platform-only carve-out list.
    expect(WEB_ONLY.has("recipe_shopping_list_v1")).toBe(false);
    expect(MOBILE_ONLY.has("recipe_shopping_list_v1")).toBe(false);
  });

  it("ENG-722 log-confirm checkmark flag defaults ON on both platforms", () => {
    // The visual half of the commit feedback (haptic shipped 2026-04-28) ships
    // default-on per the "always flag on" beta-window policy — registered in
    // REDESIGN_DEFAULT_ON, NOT KNOWN_DEFAULT_OFF_FLAGS, on web AND mobile.
    expect(web.has("log_confirm_check_v1"), "web log_confirm_check_v1").toBe(true);
    expect(mobile.has("log_confirm_check_v1"), "mobile log_confirm_check_v1").toBe(
      true,
    );
  });

  it("core design-system flags default ON on both platforms", () => {
    const core = [
      "design_system_colours",
      "design_system_brandmark",
      "design_system_icons",
      "redesign_winmoment",
      "redesign_motion",
      "redesign_branded_sheets",
      "redesign_search_results",
    ];
    for (const flag of core) {
      expect(web.has(flag)).toBe(true);
      expect(mobile.has(flag)).toBe(true);
    }
  });

  // (The `today_meals_figma_layout` kill-switch flag was removed in ENG-1096
  // along with the dead summary layout — no flag to keep out of default-on.)

  // (ENG-1651 — `design_system_elevation` collapsed out of REDESIGN_DEFAULT_ON
  // on both platforms: the flag was removed entirely and its ON-branch
  // styling now ships unconditionally, so it's no longer parsed out of either
  // source file and no longer belongs in the "core design-system flags" list
  // above.)

  // (ENG-1651 round 2, slice 3 — `today_log_usual_row_v2` collapsed out of
  // REDESIGN_DEFAULT_ON and GATE_15_SHARED on both platforms: the flag was
  // removed entirely and the dedicated "Log usual" row now ships
  // unconditionally, so it's no longer parsed out of either source file.)
});
