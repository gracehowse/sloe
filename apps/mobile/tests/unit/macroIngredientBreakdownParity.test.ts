/**
 * ENG-748 #10 — "By ingredient" macro breakdown parity pin.
 *
 * The per-ingredient breakdown must be DERIVED via the single shared helper
 * (`src/lib/nutrition/macroIngredientBreakdown.ts`) on BOTH platforms — never a
 * second mobile copy of the scale/reconcile maths. This test fails loudly if the
 * mobile macro-detail screen drops the shared import or the web panel diverges.
 *
 * It also exercises the shared helper itself through the `@suppr/shared` alias so
 * the mobile CI shard (which can't see the web-authored
 * `tests/unit/macroIngredientBreakdown.test.ts`) still proves the logic compiles
 * and runs RN-side.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  deriveIngredientBreakdown,
  toBreakdownEntry,
  toBreakdownIngredientRow,
  toBreakdownSnapshotRow,
} from "@suppr/nutrition-core/macroIngredientBreakdown";

// The mobile data + derive logic lives in the composition-root hook
// (ENG-621 pattern); the screen is a thin shell that consumes it.
const MOBILE_HOOK = resolve(__dirname, "../../app/useMacroDetail.ts");
const MOBILE_HOOK_SRC = readFileSync(MOBILE_HOOK, "utf8");

const MOBILE_SCREEN = resolve(__dirname, "../../app/macro-detail.tsx");
const MOBILE_SCREEN_SRC = readFileSync(MOBILE_SCREEN, "utf8");

const MOBILE_TODAY = resolve(__dirname, "../../app/(tabs)/_today/TodayScreen.tsx");
const MOBILE_TODAY_SRC = readFileSync(MOBILE_TODAY, "utf8");

const WEB_PANEL = resolve(__dirname, "../../../../src/app/components/MacroDetailPanel.tsx");
const WEB_SRC = readFileSync(WEB_PANEL, "utf8");

const WEB_TRACKER = resolve(
  __dirname,
  "../../../../src/app/components/NutritionTracker.tsx",
);
const WEB_TRACKER_SRC = readFileSync(WEB_TRACKER, "utf8");

describe("macro-detail ingredient breakdown — shared-helper wiring", () => {
  it("mobile hook imports the shared derive helper (not a local copy)", () => {
    expect(MOBILE_HOOK_SRC).toMatch(
      /from\s+["'][^"']*@suppr\/(?:shared\/nutrition|nutrition-core)\/macroIngredientBreakdown["']/,
    );
    expect(MOBILE_HOOK_SRC).toMatch(/\bderiveIngredientBreakdown\b/);
    expect(MOBILE_HOOK_SRC).toMatch(/\btoBreakdownEntry\b/);
    expect(MOBILE_HOOK_SRC).toMatch(/\btoBreakdownIngredientRow\b/);
  });

  it("web panel imports the SAME shared derive helper", () => {
    expect(WEB_SRC).toMatch(
      /from\s+["'][^"']*\/lib\/nutrition\/macroIngredientBreakdown["']/,
    );
    expect(WEB_SRC).toMatch(/\bderiveIngredientBreakdown\b/);
    expect(WEB_SRC).toMatch(/\btoBreakdownEntry\b/);
  });

  it("mobile batches recipe_ingredients in one query (no N+1)", () => {
    expect(MOBILE_HOOK_SRC).toMatch(/from\(["']recipe_ingredients["']\)/);
    expect(MOBILE_HOOK_SRC).toMatch(/\.in\(["']recipe_id["']/);
  });

  it("mobile entries query carries recipe_id + portion_multiplier", () => {
    expect(MOBILE_HOOK_SRC).toMatch(/recipe_id/);
    expect(MOBILE_HOOK_SRC).toMatch(/portion_multiplier/);
  });

  it("mobile screen consumes the hook + renders the ingredient list with the toggle", () => {
    expect(MOBILE_SCREEN_SRC).toMatch(/\buseMacroDetail\b/);
    expect(MOBILE_SCREEN_SRC).toMatch(/\bMacroIngredientList\b/);
    expect(MOBILE_SCREEN_SRC).toMatch(/macro-detail-breakdown-toggle/);
    expect(MOBILE_SCREEN_SRC).toMatch(/supportsIngredientBreakdown/);
  });
});

describe("nutrition_entry_ingredients snapshot — web↔mobile wiring (ENG-751)", () => {
  it("both READ paths fetch the snapshot table by entry_id + pass preferSnapshot", () => {
    for (const src of [MOBILE_HOOK_SRC, WEB_TRACKER_SRC]) {
      expect(src).toMatch(/NUTRITION_ENTRY_INGREDIENTS_TABLE/);
      expect(src).toMatch(/\.in\(["']entry_id["']/);
      expect(src).toMatch(/NUTRITION_ENTRY_INGREDIENTS_FLAG/);
    }
    // Both derive callsites opt into the snapshot path via the shared helper.
    expect(MOBILE_HOOK_SRC).toMatch(/preferSnapshot/);
    expect(WEB_SRC).toMatch(/preferSnapshot/);
  });

  it("both READ paths gate the snapshot split behind the display flag", () => {
    expect(MOBILE_HOOK_SRC).toMatch(/isFeatureEnabled\(NUTRITION_ENTRY_INGREDIENTS_FLAG\)/);
    // Web panel reads the flag for preferSnapshot; tracker gates the fetch.
    expect(WEB_SRC).toMatch(/isFeatureEnabled\(NUTRITION_ENTRY_INGREDIENTS_FLAG\)/);
    expect(WEB_TRACKER_SRC).toMatch(/isFeatureEnabled\(NUTRITION_ENTRY_INGREDIENTS_FLAG\)/);
  });

  it("both WRITE paths call the shared defensive persist helper in commitAiLoggedItems", () => {
    for (const src of [MOBILE_TODAY_SRC, WEB_TRACKER_SRC]) {
      expect(src).toMatch(/persistEntryIngredientSnapshot/);
    }
  });

  it("both platforms register the flag default-OFF (NOT in REDESIGN_DEFAULT_ON)", () => {
    const webFlags = readFileSync(
      resolve(__dirname, "../../../../src/lib/analytics/track.ts"),
      "utf8",
    );
    const mobileFlags = readFileSync(
      resolve(__dirname, "../../lib/analytics.ts"),
      "utf8",
    );
    for (const src of [webFlags, mobileFlags]) {
      expect(src).toMatch(/KNOWN_DEFAULT_OFF_FLAGS/);
      expect(src).toMatch(/nutrition_entry_ingredients_v1/);
      // Must NOT be a member of the default-on set. Slice from the set name to
      // its closing `]);` only (excludes the trailing default-OFF doc comment,
      // which legitimately names the flag).
      const setStart = src.indexOf("REDESIGN_DEFAULT_ON");
      const setEnd = src.indexOf("]);", setStart);
      const defaultOnSet = src.slice(setStart, setEnd);
      expect(defaultOnSet).not.toMatch(/nutrition_entry_ingredients_v1/);
    }
  });
});

describe("shared helper runs RN-side (mobile CI shard)", () => {
  it("scales + reconciles a recipe entry to its stored total", () => {
    const { lines, total } = deriveIngredientBreakdown(
      [
        toBreakdownEntry({
          id: "e1",
          name: "Dinner",
          recipeTitle: "Bowl",
          recipeId: "r1",
          portionMultiplier: 2,
          protein: 30,
        }),
      ],
      [
        toBreakdownIngredientRow({ recipeId: "r1", name: "Chicken", protein: 12 }),
        toBreakdownIngredientRow({ recipeId: "r1", name: "Rice", protein: 3 }),
      ],
      "protein",
    );
    // scaled [24, 6] sum 30; factor 30/30=1 → [24, 6], sums to stored 30.
    expect(total).toBeCloseTo(30, 6);
    expect(lines.find((l) => l.name === "Chicken")?.value).toBeCloseTo(24, 6);
    expect(lines.reduce((s, l) => s + l.value, 0)).toBeCloseTo(30, 6);
  });

  it("falls back to a single self-named line for a recipe-less entry", () => {
    const { lines } = deriveIngredientBreakdown(
      [
        toBreakdownEntry({
          id: "e1",
          name: "Snack",
          recipeTitle: "Banana",
          recipeId: null,
          portionMultiplier: 1,
          carbs: 27,
        }),
      ],
      [],
      "carbs",
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].name).toBe("Banana");
    expect(lines[0].isFallback).toBe(true);
  });

  it("splits an AI entry by its snapshot rows when preferSnapshot is on (ENG-751)", () => {
    const { lines, total } = deriveIngredientBreakdown(
      [
        toBreakdownEntry({
          id: "ai1",
          name: "Lunch",
          recipeTitle: "Burrito bowl",
          recipeId: null,
          portionMultiplier: 1,
          protein: 40,
        }),
      ],
      [],
      "protein",
      {
        snapshots: [
          toBreakdownSnapshotRow({ entryId: "ai1", name: "Chicken", lowConfidence: false, protein: 30 }),
          toBreakdownSnapshotRow({ entryId: "ai1", name: "Rice", lowConfidence: true, protein: 10 }),
        ],
        preferSnapshot: true,
      },
    );
    expect(total).toBeCloseTo(40, 6);
    expect(lines.map((l) => l.name).sort()).toEqual(["Chicken", "Rice"]);
    // Low-confidence flag carried through RN-side too.
    expect(lines.find((l) => l.name === "Rice")?.lowConfidence).toBe(true);
  });
});
