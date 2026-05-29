/**
 * P2-28 (2026-04-25) — pin web ↔ mobile algorithm parity behaviourally.
 *
 * Pre-P2-28 the test asserted static-text invariants (e.g. "the web
 * file must reference `MEAL_PLAN_RECENCY_PENALTY`") because the two
 * algorithms shipped twice with shared constants but separate bodies.
 * P2-28 deduplicated the bodies — both platforms now run the same
 * `findBestMealSetGeneric<R extends MealPlanRecipe>` from
 * `mealPlanAlgo.ts`. The static-text assertions are no longer
 * meaningful (the web file legitimately doesn't reference the
 * recency-penalty constant directly anymore — it imports the
 * generic, which does).
 *
 * The replacement is behavioural: build a fixture in both
 * `SimpleRecipe` and `RecipeCard` shapes from the same source data,
 * run both `generateSmartPlan` and `generatePlanFromLibrary` with the
 * same seed + same targets + same slot order, and assert the
 * resulting day plans match by recipe-id at each slot. If a future
 * change re-introduces a divergence (different scoring, different
 * sampling, different bias), the day plans diverge and this test
 * fails.
 *
 * Plus: keep the four shared-constants assertions from P1-9 — they
 * still matter as a structural guarantee that the constants live in
 * one place.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_PLANNER_BANDS,
  MEAL_PLAN_RECENCY_PENALTY,
  MEAL_PLAN_RECENCY_RESET_DAYS,
  MEAL_PLAN_SAMPLER_CAP,
  generateSmartPlan,
  type SimpleRecipe,
} from "../../src/lib/nutrition/mealPlanAlgo";
import {
  DEFAULT_PLANNER_BANDS as WEB_BANDS,
  generatePlanFromLibrary,
} from "../../src/lib/planning/generateMealPlan";
import type { RecipeCard } from "../../src/types/recipe";

const TARGETS = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
  fiber: 28,
  calorieBandPct: 12,
  carbFatBandPct: 18,
};

/**
 * Source data for a single recipe — neutral on platform shape so the
 * fixture builders below project it into either `SimpleRecipe` (mobile)
 * or `RecipeCard` (web). Slot tags use the lowercase form
 * `mealPlannerSlotsFromMealType` consumes; the projector maps them to
 * each platform's tag field.
 */
type Source = {
  id: string;
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  /** Lowercase slot tags: 'breakfast' | 'lunch' | 'dinner' | 'snack'. */
  slots: Array<"breakfast" | "lunch" | "dinner" | "snack">;
};

const SLOT_LABEL: Record<Source["slots"][number], "Breakfast" | "Lunch" | "Dinner" | "Snacks"> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

function asMobile(s: Source): SimpleRecipe {
  return {
    id: s.id,
    title: s.title,
    calories: s.calories,
    protein: s.protein,
    carbs: s.carbs,
    fat: s.fat,
    fiberG: s.fiberG,
    mealType: s.slots,
  };
}

function asWeb(s: Source): RecipeCard {
  return {
    id: s.id,
    title: s.title,
    calories: s.calories,
    protein: s.protein,
    carbs: s.carbs,
    fat: s.fat,
    fiberG: s.fiberG,
    mealSlots: s.slots.map((t) => SLOT_LABEL[t]),
    creatorName: "Test",
    creatorImage: "",
    image: "",
    servings: 1,
    isVerified: true,
    savedCount: 0,
    isSaved: false,
  } as RecipeCard;
}

const FIXTURE: Source[] = [
  { id: "oats", title: "Overnight Oats", calories: 380, protein: 28, carbs: 50, fat: 8, fiberG: 6, slots: ["breakfast"] },
  { id: "yogurt", title: "Greek Yogurt Bowl", calories: 320, protein: 30, carbs: 30, fat: 8, fiberG: 4, slots: ["breakfast"] },
  { id: "salad", title: "Chicken Salad", calories: 480, protein: 45, carbs: 25, fat: 18, fiberG: 5, slots: ["lunch"] },
  { id: "wrap", title: "Turkey Wrap", calories: 520, protein: 38, carbs: 50, fat: 16, fiberG: 4, slots: ["lunch"] },
  { id: "salmon", title: "Salmon Plate", calories: 620, protein: 50, carbs: 35, fat: 28, fiberG: 4, slots: ["dinner"] },
  { id: "stirfry", title: "Beef Stir Fry", calories: 580, protein: 42, carbs: 50, fat: 20, fiberG: 5, slots: ["dinner"] },
  { id: "nuts", title: "Mixed Nuts", calories: 200, protein: 8, carbs: 8, fat: 18, fiberG: 3, slots: ["snack"] },
  { id: "cheese", title: "Cheese & Crackers", calories: 220, protein: 10, carbs: 18, fat: 12, fiberG: 1, slots: ["snack"] },
];

describe("mealPlanWebMobileParity — shared constants (P1-9)", () => {
  it("recency penalty is 100 across both algorithms", () => {
    expect(MEAL_PLAN_RECENCY_PENALTY).toBe(100);
  });

  it("recency reset window is 5 days across both algorithms", () => {
    expect(MEAL_PLAN_RECENCY_RESET_DAYS).toBe(5);
  });

  it("default planner bands are 5/15", () => {
    expect(DEFAULT_PLANNER_BANDS.calorieBandPct).toBe(5);
    expect(DEFAULT_PLANNER_BANDS.carbFatBandPct).toBe(15);
  });

  it("web re-exports the same DEFAULT_PLANNER_BANDS object — single source of truth", () => {
    expect(WEB_BANDS).toBe(DEFAULT_PLANNER_BANDS);
  });

  it("sampler cap is 2_000 (P0-5)", () => {
    expect(MEAL_PLAN_SAMPLER_CAP).toBe(2_000);
  });
});

describe("mealPlanWebMobileParity — behavioural (P2-28)", () => {
  /**
   * Both algorithms now run through `findBestMealSetGeneric` so the
   * resulting plans must match by recipe-id at every slot for a given
   * fixture + seed + target set. This is the strongest guarantee the
   * parity test can give post-dedup; if a future change introduces a
   * platform-specific scoring tweak, this test fails.
   */
  function runBoth(seed: number, days = 1) {
    const mobilePool = FIXTURE.map(asMobile);
    const webPool = FIXTURE.map(asWeb);
    const mobile = generateSmartPlan({ recipes: mobilePool, targets: TARGETS, days, seed });
    const web = generatePlanFromLibrary({ savedRecipes: webPool, targets: TARGETS, days, seed });
    return { mobile, web };
  }

  it("same fixture + seed produces the same recipe-id at every slot — single day", () => {
    const { mobile, web } = runBoth(42);
    expect(mobile).toHaveLength(1);
    expect(web).toHaveLength(1);
    const mobileBySlot = Object.fromEntries(mobile[0]!.meals.map((m) => [m.name, m.recipeId]));
    const webBySlot = Object.fromEntries(web[0]!.meals.map((m) => [m.name, m.recipeId]));
    expect(mobileBySlot).toEqual(webBySlot);
  });

  it("same fixture + seed produces the same recipe-id at every slot — multi-day plan", () => {
    const { mobile, web } = runBoth(42, 5);
    expect(mobile).toHaveLength(5);
    expect(web).toHaveLength(5);
    for (let d = 0; d < 5; d++) {
      const mobileBySlot = Object.fromEntries(mobile[d]!.meals.map((m) => [m.name, m.recipeId]));
      const webBySlot = Object.fromEntries(web[d]!.meals.map((m) => [m.name, m.recipeId]));
      expect(mobileBySlot, `day ${d + 1}`).toEqual(webBySlot);
    }
  });

  it("totals (calories) match between web + mobile for the same fixture + seed", () => {
    const { mobile, web } = runBoth(42, 3);
    for (let d = 0; d < 3; d++) {
      expect(web[d]!.totals.calories, `day ${d + 1} kcal`).toBe(mobile[d]!.totals.calories);
    }
  });

  it("residualProteinGap is consistent between platforms", () => {
    const { mobile, web } = runBoth(42, 3);
    for (let d = 0; d < 3; d++) {
      const mGap = mobile[d]!.residualProteinGap ?? 0;
      const wGap = web[d]!.residualProteinGap ?? 0;
      expect(wGap, `day ${d + 1} protein gap`).toBe(mGap);
    }
  });

  it("web MealPlanner swap re-fits the whole day via refitDayMealsToTargets (ENG-664)", () => {
    const src = readFileSync(
      resolve(__dirname, "../../src/app/components/MealPlanner.tsx"),
      "utf8",
    );
    expect(src).toMatch(/refitDayMealsToTargets/);
    expect(src).toMatch(/scaleMacros\(baseRecipes\[mi\]/);
  });

  it("a third seed agrees web↔mobile too — three-way confidence the dedup isn't seed-specific", () => {
    // The two-seed case proves it works; a third seed catches a bug class
    // where the platforms might agree on seeds 1 and 42 but diverge on
    // some other seed (e.g. an off-by-one in how the rand stream is
    // consumed).
    const seed = 7919;
    const { mobile, web } = runBoth(seed, 2);
    for (let d = 0; d < 2; d++) {
      const mobileBySlot = Object.fromEntries(mobile[d]!.meals.map((m) => [m.name, m.recipeId]));
      const webBySlot = Object.fromEntries(web[d]!.meals.map((m) => [m.name, m.recipeId]));
      expect(mobileBySlot, `seed ${seed} day ${d + 1}`).toEqual(webBySlot);
    }
  });
});
