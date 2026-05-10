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
    // Web uses `recipeMissing`; mobile inlines the check inside the JSX.
    expect(WEB_SRC).toMatch(/recipeMissing/);
    expect(WEB_SRC).toMatch(/!knownRecipeIds\.has\(recipeId/);
    expect(MOBILE_SRC).toMatch(/!knownRecipeIds\.has\(meal\.recipeId\)/);
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

  it("the badge does not render for empty/placeholder slots (no recipeId at all)", () => {
    // Both surfaces gate the badge behind a truthy recipeId — the
    // condition must include `recipeId` (web) / `meal.recipeId` (mobile).
    expect(WEB_SRC).toMatch(/Boolean\(recipeId\)\s*&&\s*!knownRecipeIds\.has/);
    expect(MOBILE_SRC).toMatch(/meal\.recipeId\s*&&\s*!knownRecipeIds\.has/);
  });
});
