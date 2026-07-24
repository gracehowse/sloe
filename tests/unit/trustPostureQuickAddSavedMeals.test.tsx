/**
 * trustPostureQuickAddSavedMeals — pins the trust-posture sweep
 * extension to QuickAdd + Saved meals (audit 2026-04-30 round-2 fix
 * #B7).
 *
 * Authority: D-2026-04-27-16 (consistent trust posture on every
 * macro-bearing row, app-wide).
 *
 * The original Phase 3 / Phase 4 sweeps (`trustPostureSweepPhase3` +
 * `trustPostureSweepPhase4`) covered diary, LogSheet, recipe detail,
 * ingredients, Library, and Discover. QuickAdd + Saved meals were
 * not enumerated in the roadmap row and therefore did not get the
 * SourceDot. This file pins the gap closure.
 *
 * Two layers:
 *  1. File-source pins — read the QuickAddPanel + SavedMealsTab on
 *     web AND the QuickAddPanel on mobile, assert the canonical
 *     SourceDot + mapping helpers are threaded through.
 *  2. Behaviour pins — call `dominantSavedMealSource` against the
 *     legacy variants the journal carries (USDA / OFF / AI / Custom).
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import { dominantSavedMealSource } from "../../src/lib/nutrition/savedMealsLogic";
import { mapMealSourceToDot } from "../../src/lib/nutrition/sourceMap";
import type { SavedMeal, SavedMealItem } from "../../src/lib/nutrition/savedMeals";

const REPO_ROOT = path.resolve(__dirname, "../..");

function read(relPath: string): string {
  return fs.readFileSync(path.resolve(REPO_ROOT, relPath), "utf8");
}

function mkMeal(items: Partial<SavedMealItem>[]): SavedMeal {
  return {
    id: "m1",
    name: "Test meal",
    items: items.map((it, i) => ({
      position: i,
      recipeTitle: "Item",
      calories: 100,
      protein: 5,
      carbs: 12,
      fat: 3,
      ...it,
    })),
    createdAt: "2026-04-30T08:00:00.000Z",
    logCount: 0,
  };
}

describe("QuickAdd / SavedMeals trust posture wiring (file-source pins)", () => {
  it("web QuickAddPanel imports SourceDot + mapMealSourceToDot", () => {
    const src = read("src/app/components/suppr/quick-add-panel.tsx");
    expect(src).toMatch(/import\s*\{\s*SourceDot\s*\}\s*from/);
    expect(src).toMatch(/import\s*\{\s*mapMealSourceToDot\s*\}\s*from/);
  });

  it("web QuickAddPanel renders SourceDot at size=6 for non-saved rows", () => {
    const src = read("src/app/components/suppr/quick-add-panel.tsx");
    // The favourites / recent / frequent row must render a SourceDot.
    expect(src).toMatch(/<SourceDot[\s\S]+?size=\{6\}/);
    // And it must be derived from the row's source via the mapper —
    // never hard-coded.
    expect(src).toMatch(/source=\{mapMealSourceToDot\(row\.source[\s\S]*?\)\}/);
  });

  it("web SavedMealsTab imports SourceDot + dominantSavedMealSource", () => {
    const src = read("src/app/components/suppr/saved-meals-tab.tsx");
    expect(src).toMatch(/import\s*\{\s*SourceDot\s*\}\s*from/);
    expect(src).toMatch(/dominantSavedMealSource/);
  });

  it("web SavedMealsTab renders SourceDot at size=6 for every saved meal row", () => {
    const src = read("src/app/components/suppr/saved-meals-tab.tsx");
    expect(src).toMatch(/<SourceDot[\s\S]+?size=\{6\}/);
  });

  it("mobile QuickAddPanel imports SourceDot + mapMealSourceToDot", () => {
    // ENG-1565: row chrome lives in QuickAddPanelRows extract.
    const src = `${read("apps/mobile/components/QuickAddPanel.tsx")}\n${read("apps/mobile/components/quick-add/QuickAddPanelRows.tsx")}`;
    expect(src).toMatch(/import\s*\{\s*SourceDot\s*\}\s*from/);
    expect(src).toMatch(/import\s*\{\s*mapMealSourceToDot\s*\}\s*from/);
  });

  it("mobile QuickAddPanel imports dominantSavedMealSource (saved-meal row)", () => {
    const src = `${read("apps/mobile/components/QuickAddPanel.tsx")}\n${read("apps/mobile/components/quick-add/QuickAddPanelRows.tsx")}`;
    expect(src).toMatch(/dominantSavedMealSource/);
  });

  it("mobile QuickAddPanel renders SourceDot at size=6 (favourites + saved rows)", () => {
    const src = `${read("apps/mobile/components/QuickAddPanel.tsx")}\n${read("apps/mobile/components/quick-add/QuickAddPanelRows.tsx")}`;
    // Both paths render a SourceDot; assert at least 2 occurrences.
    const matches = src.match(/<SourceDot[\s\S]*?size=\{6\}/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("dominantSavedMealSource — covers the legacy journal variants", () => {
  it("USDA tally folds variant casings", () => {
    const meal = mkMeal([
      { source: "USDA" },
      { source: "usda" },
      { source: "Custom" },
    ]);
    expect(dominantSavedMealSource(meal)).toBe("usda");
  });

  it("OFF tally folds 'OFF' / 'Open Food Facts' / OpenFoodFacts", () => {
    const meal = mkMeal([
      { source: "OFF" },
      { source: "Open Food Facts" },
      { source: "OpenFoodFacts" },
    ]);
    expect(dominantSavedMealSource(meal)).toBe("off");
  });

  it("AI tally folds 'AI photo' / 'AI estimate'", () => {
    const meal = mkMeal([
      { source: "AI photo" },
      { source: "AI estimate" },
    ]);
    expect(dominantSavedMealSource(meal)).toBe("ai");
  });

  it("Custom tally falls back to manual", () => {
    const meal = mkMeal([{ source: "Custom" }]);
    expect(dominantSavedMealSource(meal)).toBe("manual");
  });

  it("missing source on every item → manual fallback (parity with mapMealSourceToDot null)", () => {
    const meal = mkMeal([{}, {}, {}]);
    expect(dominantSavedMealSource(meal)).toBe("manual");
    // Sanity: same fallback as the mapper itself for null input.
    expect(mapMealSourceToDot(null)).toBe("manual");
  });
});
