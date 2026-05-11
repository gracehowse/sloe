/**
 * Schema refactor Phase 2 — client wiring for nutrition_entries.recipe_id.
 *
 * Plan doc: docs/planning/schema-refactor-plan-recipe-fk-cascade.md
 *
 * Phase 1 (PR #190) added the column + FK against recipes.id ON DELETE
 * SET NULL. Phase 2 (this PR) populates it from every client insert
 * site that has a recipe id in scope.
 *
 * This static-analysis test pins both surfaces so a refactor that
 * silently drops the recipe_id assignment fails CI before it ships.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB_JOURNAL_HOOK = readFileSync(
  resolve(__dirname, "../../src/context/appData/useNutritionJournalState.ts"),
  "utf8",
);
const MOBILE_TODAY = readFileSync(
  resolve(__dirname, "../../apps/mobile/app/(tabs)/index.tsx"),
  "utf8",
);
const MOBILE_RECIPE_DETAIL = readFileSync(
  resolve(__dirname, "../../apps/mobile/app/recipe/[id].tsx"),
  "utf8",
);
const WEB_LOGGED_MEAL_TYPE = readFileSync(
  resolve(__dirname, "../../src/types/recipe.ts"),
  "utf8",
);
const MOBILE_JOURNAL_MEAL_TYPE = readFileSync(
  resolve(__dirname, "../../apps/mobile/lib/nutritionJournal.ts"),
  "utf8",
);

describe("Phase 2 — LoggedMeal / JournalMeal carry the optional recipeId", () => {
  it("web LoggedMeal type includes optional recipeId", () => {
    expect(WEB_LOGGED_MEAL_TYPE).toMatch(/recipeId\?:\s*string;/);
  });

  it("mobile JournalMeal type includes optional recipeId", () => {
    expect(MOBILE_JOURNAL_MEAL_TYPE).toMatch(/recipeId\?:\s*string;/);
  });
});

describe("Phase 2 — web journal builder threads recipe_id into the insert row", () => {
  it("buildNutritionEntryRow includes recipe_id from meal.recipeId", () => {
    expect(WEB_JOURNAL_HOOK).toMatch(
      /buildNutritionEntryRow[\s\S]*?recipe_id:\s*meal\.recipeId\s*\?\?\s*null/,
    );
  });

  it("NutritionEntryRow type includes recipe_id from the SELECT", () => {
    expect(WEB_JOURNAL_HOOK).toMatch(/recipe_id:\s*string\s*\|\s*null/);
  });

  it("rowToLoggedMeal carries recipe_id back into LoggedMeal.recipeId", () => {
    expect(WEB_JOURNAL_HOOK).toMatch(
      /rowToLoggedMeal[\s\S]*?row\.recipe_id\s*\?\s*\{\s*recipeId:\s*row\.recipe_id\s*\}\s*:\s*\{\}/,
    );
  });

  it("the SELECT includes recipe_id", () => {
    expect(WEB_JOURNAL_HOOK).toMatch(
      /\.select\("[^"]*recipe_id[^"]*"\)/,
    );
  });
});

describe("Phase 2 — mobile insert sites populate recipe_id", () => {
  it("recipe detail log includes recipe_id: recipe.id", () => {
    expect(MOBILE_RECIPE_DETAIL).toMatch(
      /from\("nutrition_entries"\)\.insert\(\{[\s\S]*?recipe_id:\s*recipe\.id/,
    );
  });

  it("planner log (logPlannedMealWithPortion) includes recipe_id from pm", () => {
    expect(MOBILE_TODAY).toMatch(
      /from\("nutrition_entries"\)\.insert\(\{[\s\S]*?recipe_id:\s*pm\.recipe_id\s*\?\?\s*null/,
    );
  });

  it("copy/duplicate path propagates recipe_id from JournalMeal.recipeId", () => {
    expect(MOBILE_TODAY).toMatch(
      /recipe_id:\s*m\.recipeId\s*\?\?\s*null/,
    );
  });

  it("today SELECT loads recipe_id back into JournalMeal.recipeId", () => {
    expect(MOBILE_TODAY).toMatch(
      /\.select\("[^"]*recipe_id[^"]*"\)/,
    );
    expect(MOBILE_TODAY).toMatch(
      /recipeId:\s*\(r as[\s\S]{0,80}\)\.recipe_id\s*\?\?\s*undefined/,
    );
  });
});
