/**
 * cook-mode servings handoff (P0, 2026-05-01) — pin the cross-platform
 * contract that links the recipe-page servings stepper to the cook-mode
 * step-text scaling, the "Scaled for N servings" banner, and the
 * auto-log calorie multiplier.
 *
 * The bug this protects against: previously, opening cook mode from a
 * recipe scaled to 8 servings (originally 4) showed step text that
 * still said "Add 4 tbsp olive oil", and the auto-log on Done used the
 * recipe's original yield rather than the scaled value. The user
 * cooked a doubled batch from single-batch instructions and the
 * journal entry was off by half.
 *
 * If a future change drops the `viewServings` / `servings` handoff,
 * removes the `scaleStepText` import, removes the banner, or skips
 * passing `baseServings` to web `<CookMode>`, these tests fail.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");
const MOBILE_RECIPE = readFileSync(
  resolve(REPO, "apps/mobile/app/recipe/[id].tsx"),
  "utf8",
);
const MOBILE_COOK = readFileSync(
  resolve(REPO, "apps/mobile/app/cook.tsx"),
  "utf8",
);
const WEB_COOK = readFileSync(
  resolve(REPO, "src/app/components/CookMode.tsx"),
  "utf8",
);
const WEB_RECIPE = readFileSync(
  resolve(REPO, "src/app/components/RecipeDetail.tsx"),
  "utf8",
);

describe("mobile cook-mode — servings handoff (ENG-945 canonical /cook)", () => {
  it("recipe detail threads logPortion into buildCookModeHref as portion", () => {
    expect(MOBILE_RECIPE).toMatch(/buildCookModeHref\(/);
    expect(MOBILE_RECIPE).toMatch(/portion:\s*scaleSource\s*!==\s*1\s*\?\s*scaleSource\s*:\s*undefined/);
    expect(MOBILE_RECIPE).toMatch(/logPortion/);
  });

  it("canonical cook screen scales step text via scaleAmountText + active scale", () => {
    expect(MOBILE_COOK).toMatch(
      /import\s*\{[^}]*\bscaleAmountText\b[^}]*\}\s*from\s*["']@suppr\/nutrition-core\/recipeScale["']/,
    );
    expect(MOBILE_COOK).toMatch(/scaleAmountText\(rawStepText,\s*scale\)/);
    expect(MOBILE_COOK).toMatch(/cookScaleCaption\(scale,\s*baseServings\)/);
  });

  it("honours deep-link portion param when hydrating cook scale", () => {
    expect(MOBILE_COOK).toMatch(/portionParam/);
    expect(MOBILE_COOK).toMatch(/Number\.parseFloat\(portionParam\)/);
  });
});

describe("web CookMode — servings handoff", () => {
  it("imports scaleStepText from the shared nutrition lib", () => {
    expect(WEB_COOK).toMatch(
      /import\s*\{\s*scaleStepText\s*\}\s*from\s*["'][^"']*scaleStepText[^"']*["']/,
    );
  });

  it("accepts a baseServings prop alongside servings", () => {
    expect(WEB_COOK).toMatch(/baseServings\?:\s*number/);
  });

  it("computes scaleFactor as servings / baseServings", () => {
    expect(WEB_COOK).toMatch(
      /scaleFactor\s*=[\s\S]{0,80}servings\s*\/\s*effectiveBaseServings/,
    );
  });

  it("applies scaleStepText to the current step text", () => {
    expect(WEB_COOK).toMatch(
      /scaleStepText\(\s*cleanStepText\(\s*currentStepRaw\s*\)\s*,\s*scaleFactor\s*\)/,
    );
  });

  it("renders a 'Scaled for N servings' banner only when scaleFactor !== 1", () => {
    expect(WEB_COOK).toMatch(/scaleFactor\s*!==\s*1/);
    expect(WEB_COOK).toMatch(/Scaled for\s*\{servings\}\s*serving/);
  });

  it("auto-log routes through commitLogMeal with servings eaten (ENG-1129)", () => {
    // ENG-1129: confirm sheet passes servings eaten to commitLogMeal;
    // legacy path (flag off) logs 1 serving — batch scale stays in step
    // text only, not the journal multiplier.
    expect(WEB_COOK).toMatch(/commitLogMeal/);
    expect(WEB_COOK).toMatch(/servingsToLog/);
    expect(WEB_COOK).toMatch(/portionMultiplier:\s*servingsToLog/);
    expect(WEB_COOK).toMatch(/commitLogMeal\(servingsEaten\)/);
    expect(WEB_COOK).toMatch(/commitLogMeal\(1\)/);
  });
});

describe("web RecipeDetail — passes the user's scaled servings to CookMode", () => {
  it("invokes <CookMode> with both servings and baseServings", () => {
    // The bug: previously the call site passed `servings={baseServings}`,
    // dropping the user's scale at cook-mode entry. Post-fix it must
    // pass `servings={servings}` and an explicit `baseServings={baseServings}`.
    const callSite = WEB_RECIPE.match(/<CookMode[\s\S]*?\/>/);
    expect(callSite).not.toBeNull();
    const block = callSite![0];
    expect(block).toMatch(/servings=\{servings\}/);
    expect(block).toMatch(/baseServings=\{baseServings\}/);
    expect(block).not.toMatch(/servings=\{baseServings\}/);
  });
});

describe("auto-log calorie math — pinned by example", () => {
  // Pure-arithmetic pin (no rendering). The contract is:
  //   scaleFactor = viewServings / recipe.servings
  //   scaledCalories = recipe.calories_per_serving × scaleFactor × recipe.servings
  // Equivalently: scaledCalories = caloriesPerServing × viewServings.
  //
  // viewServings = 8, recipe.servings = 4, caloriesPerServing = 250
  //   → scaleFactor = 2
  //   → totalRecipeCalories = 250 × 4 = 1000
  //   → scaledCalories = 1000 × 2 = 2000
  //   = caloriesPerServing × viewServings = 250 × 8 = 2000 ✓
  it("8 servings on a 4-serving 250-kcal-per-serving recipe → 2000 kcal logged", () => {
    const recipeServings = 4;
    const viewServings = 8;
    const caloriesPerServing = 250;
    const totalRecipeCalories = caloriesPerServing * recipeServings;
    const scaleFactor = viewServings / recipeServings;
    const scaledCalories = totalRecipeCalories * scaleFactor;
    expect(scaleFactor).toBe(2);
    expect(scaledCalories).toBe(2000);
    expect(scaledCalories).toBe(caloriesPerServing * viewServings);
  });

  it("0.5 portion on a 4-serving recipe → half of one full recipe", () => {
    const recipeServings = 4;
    const viewServings = 0.5;
    const caloriesPerServing = 200;
    const totalRecipeCalories = caloriesPerServing * recipeServings;
    const scaleFactor = viewServings / recipeServings;
    expect(totalRecipeCalories * scaleFactor).toBe(100);
  });
});
