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
  resolve(__dirname, "../../apps/mobile/app/(tabs)/_today/TodayScreen.tsx"),
  "utf8",
);
const MOBILE_COPY_DUPLICATE = readFileSync(
  resolve(__dirname, "../../apps/mobile/hooks/useCopyDuplicateMeal.ts"),
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
    // ENG-1290 extracted the column list into NUTRITION_ENTRY_SELECT_COLUMNS
    // (shared by the boot load and the out-of-window day fetch). The contract
    // holds through the indirection: the const carries recipe_id, and every
    // .select() on this surface uses the const.
    expect(WEB_JOURNAL_HOOK).toMatch(
      /NUTRITION_ENTRY_SELECT_COLUMNS\s*=\s*"[^"]*recipe_id[^"]*"/,
    );
    expect(WEB_JOURNAL_HOOK).toMatch(/\.select\(NUTRITION_ENTRY_SELECT_COLUMNS\)/);
    // No inline entry-row select may bypass the const (the bare `select("id")`
    // probe on :107 is a connectivity check, not an entry-row read).
    expect(WEB_JOURNAL_HOOK).not.toMatch(/\.select\("[^"]*recipe_title[^"]*"\)/);
  });
});

describe("Phase 2 — mobile insert sites populate recipe_id", () => {
  it("recipe detail log includes recipe_id: recipe.id (via buildNutritionEntryRow)", () => {
    // Launch-audit P1-2 (2026-06-12): the insert now routes through the
    // shared row-builder, which maps `recipeId` → `recipe_id`. Pin the
    // JournalMeal carries `recipeId: recipe.id` AND the insert uses the
    // builder (which the builder unit tests prove emits `recipe_id`).
    expect(MOBILE_RECIPE_DETAIL).toMatch(
      /recipeId:\s*recipe\.id[\s\S]{0,400}?\.insert\(buildNutritionEntryRow\(/,
    );
  });

  it("planner log (logPlannedMealWithPortion) includes recipe_id from pm (via buildNutritionEntryRow)", () => {
    // The optimistic JournalMeal spreads `recipeId: pm.recipe_id` and the
    // insert routes through the shared builder (recipeId → recipe_id).
    expect(MOBILE_TODAY).toMatch(
      /pm\.recipe_id\s*\?\s*\{\s*recipeId:\s*pm\.recipe_id\s*\}[\s\S]{0,2400}?\.insert\(buildNutritionEntryRow\(optimisticMeal/,
    );
  });

  it("copy/duplicate path propagates recipe_id from JournalMeal.recipeId (via buildNutritionEntryRow)", () => {
    // ENG-1522 extracted copy/duplicate into `useCopyDuplicateMeal`; the
    // clone keeps `recipeId`, the shared builder maps it to `recipe_id`
    // (pinned behaviourally in nutritionEntryRowPersistence).
    expect(MOBILE_COPY_DUPLICATE).toMatch(
      /withIds\.map\(\(m\) =>\s*buildNutritionEntryRow\(m, targetDayKey, userId, profileTimeZone\)/,
    );
  });

  it("today SELECT loads recipe_id back into JournalMeal.recipeId", () => {
    // ENG-1325 — the SELECT column list + row mapping moved out of the
    // Today inline load into the shared read-side SoT in
    // `nutritionEntryRow.ts` (NUTRITION_ENTRY_SELECT_COLUMNS +
    // journalRowToMeal), reused by the out-of-window day fetch. Pin the
    // const carries recipe_id, the mapper carries it into recipeId, and
    // Today consumes both.
    const MOBILE_ENTRY_ROW = readFileSync(
      resolve(__dirname, "../../apps/mobile/lib/nutritionEntryRow.ts"),
      "utf8",
    );
    expect(MOBILE_ENTRY_ROW).toMatch(
      /NUTRITION_ENTRY_SELECT_COLUMNS\s*=\s*\n?\s*"[^"]*recipe_id[^"]*"/,
    );
    expect(MOBILE_ENTRY_ROW).toMatch(
      /recipeId:\s*\(r\.recipe_id as[\s\S]{0,60}\)\s*\?\?\s*undefined/,
    );
    expect(MOBILE_TODAY).toMatch(/\.select\(NUTRITION_ENTRY_SELECT_COLUMNS\)/);
    expect(MOBILE_TODAY).toMatch(/journalRowToMeal\(r\)/);
  });
});
