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
]);

const MOBILE_ONLY = new Set([
  // Skia hero ring — native-only; web uses SVG.
  "ring_skia_v1",
  // ENG-1097 — Today import nudge flat white card (iOS-only surface).
  "import_nudge_flat_white_v1",
  // ENG-898 — CreateRecipeActionSheet 2×2 grid; web has no action sheet surface.
  "create_recipe_action_sheet_grid_v1",
  // ENG-1225 #3 — unified "import anything" sheet shipped iOS-first; the web
  // unified front door is a pending parity build, so this is mobile-only today.
  "sloe_v3_unified_import",
]);

/** Gate 1.5 redesign surfaces that must ship default-on on both platforms. */
const GATE_15_SHARED = [
  "today_meals_figma_654",
  "today_tracker_tier_v1",
  "card_cohesion_white_v1",
  "plan_today_aim_empty_v1",
  "ring_empty_gradient_v1",
  "ring_empty_macro_parity_v1",
  "fit_verdict_banner_v1",
  "discover_import_hero_v1",
  "log-sheet-slot-selector",
  "today_log_again",
  "today_log_usual_row_v2",
  "log_sheet_nl_text_v1",
  "recipe_share_card_v1",
  "cook_log_servings_confirm",
  "plan_web_parity_v1",
  "import-save-first-v1",
  "onboarding-app-choice",
  "today_planned_empty_state",
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

  it("core design-system flags default ON on both platforms", () => {
    const core = [
      "design_system_elevation",
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
});
