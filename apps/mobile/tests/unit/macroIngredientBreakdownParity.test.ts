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
} from "@suppr/nutrition-core/macroIngredientBreakdown";

// The mobile data + derive logic lives in the composition-root hook
// (ENG-621 pattern); the screen is a thin shell that consumes it.
const MOBILE_HOOK = resolve(__dirname, "../../app/useMacroDetail.ts");
const MOBILE_HOOK_SRC = readFileSync(MOBILE_HOOK, "utf8");

const MOBILE_SCREEN = resolve(__dirname, "../../app/macro-detail.tsx");
const MOBILE_SCREEN_SRC = readFileSync(MOBILE_SCREEN, "utf8");

const WEB_PANEL = resolve(__dirname, "../../../../src/app/components/MacroDetailPanel.tsx");
const WEB_SRC = readFileSync(WEB_PANEL, "utf8");

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
});
