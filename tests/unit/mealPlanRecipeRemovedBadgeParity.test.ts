/**
 * Recipe-wave (2026-05-10) — "Defaults to recipes that don't exist".
 *
 * `meal_plans.plan` is JSONB without an FK against `recipes.id`, so a
 * `recipeId` baked into a plan row stays referenceable after the
 * underlying recipe is deleted from the library. Web pre-fix disabled
 * the click handler silently; mobile pre-fix dropped to a no-image
 * fallback. Both reads as a broken default.
 *
 * The fix surfaces a "Recipe removed" badge on each plan card whose
 * `recipeId` doesn't match anything in the in-memory recipe pool
 * (Discover seed pack + the user's saved library). This static-analysis
 * test pins both surfaces against silent regression — if someone strips
 * the badge from one side, this test breaks before the parity does.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB_PATH = resolve(__dirname, "../../src/app/components/MealPlanner.tsx");
const MOBILE_PATH = resolve(
  __dirname,
  "../../apps/mobile/app/(tabs)/planner.tsx",
);

const WEB_SRC = readFileSync(WEB_PATH, "utf8");
const MOBILE_SRC = readFileSync(MOBILE_PATH, "utf8");

describe("Meal plan 'Recipe removed' badge — web/mobile parity", () => {
  it("both surfaces compute a knownRecipeIds Set from the in-memory recipe pool", () => {
    for (const src of [WEB_SRC, MOBILE_SRC]) {
      expect(src).toMatch(/knownRecipeIds/);
      expect(src).toMatch(/new Set<string>/);
    }
  });

  it("both surfaces detect a stale recipeId per meal-card render", () => {
    // ENG-766: the stale-recipeId check (plus placeholder + hydration
    // gating) is now single-sourced in `shouldShowRecipeRemovedBadge`
    // (src/lib/nutrition/recipeRemovedBadge.ts) so web + mobile can't drift.
    for (const src of [WEB_SRC, MOBILE_SRC]) {
      expect(src).toMatch(/shouldShowRecipeRemovedBadge\(/);
      expect(src).toMatch(/knownRecipeIds/);
    }
    expect(WEB_SRC).toMatch(/recipeMissing/);
    const HELPER = readFileSync(
      resolve(__dirname, "../../src/lib/nutrition/recipeRemovedBadge.ts"),
      "utf8",
    );
    expect(HELPER).toMatch(/!knownRecipeIds\.has\(recipeId\)/);
  });

  it("both surfaces render a 'Recipe removed' badge with a matching test id", () => {
    expect(WEB_SRC).toMatch(/Recipe removed/);
    expect(WEB_SRC).toMatch(/meal-planner-recipe-removed-badge/);
    expect(MOBILE_SRC).toMatch(/Recipe removed/);
    expect(MOBILE_SRC).toMatch(/planner-recipe-removed-badge/);
  });

  it("web disables the open-recipe handler when the recipeId is stale", () => {
    expect(WEB_SRC).toMatch(/disabled=\{isPlaceholder \|\| !recipeId \|\| recipeMissing\}/);
    expect(WEB_SRC).toMatch(/if \(isPlaceholder \|\| !recipeId \|\| recipeMissing\) return;/);
  });

  it("both surfaces use accessible labelling for screen readers", () => {
    expect(WEB_SRC).toMatch(/aria-label="Recipe no longer in your library"/);
    expect(MOBILE_SRC).toMatch(/accessibilityLabel="Recipe no longer in your library"/);
  });

  it("the badge is gated on a real recipe + a hydrated library (placeholder/loading stay silent)", () => {
    // Both surfaces pass hasRecipe + recipeId into the shared helper, which
    // returns false for placeholder rows (no recipe / no id) AND during
    // hydration (libraryLoaded false — the ENG-766 flash fix).
    expect(WEB_SRC).toMatch(/hasRecipe:\s*Boolean\(recipeId\)/);
    expect(MOBILE_SRC).toMatch(/hasRecipe:\s*planMealHasRecipe\(meal\)/);
    const HELPER = readFileSync(
      resolve(__dirname, "../../src/lib/nutrition/recipeRemovedBadge.ts"),
      "utf8",
    );
    expect(HELPER).toMatch(/if \(!libraryLoaded\) return false/);
    expect(HELPER).toMatch(/if \(!hasRecipe \|\| !recipeId\) return false/);
  });
});
