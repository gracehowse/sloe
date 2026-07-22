import { describe, expect, it } from "vitest";
import {
  collectShoppingListIngredientKeys,
  computeSmartRecipeSuggestions,
  findBestPlanSlotForRecipe,
  smartSuggestionMacroFitLabel,
} from "../../src/lib/planning/smartSuggestions";
import { addRecipeToPlanSlot } from "../../src/lib/planning/addRecipeToPlanSlot";
import { DEFAULT_PLANNER_BANDS } from "../../src/lib/nutrition/mealPlanAlgo";

const salmonId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const chickenId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const soupId = "ffffffff-ffff-ffff-ffff-ffffffffffff";

const chickenRecipe = {
  id: chickenId,
  creatorName: "Test",
  creatorImage: "",
  title: "High-Protein Chicken & Rice Bowl",
  image: "",
  servings: 1,
  calories: 542,
  protein: 48,
  carbs: 52,
  fat: 12,
  isVerified: true,
  savedCount: 0,
  isSaved: false,
};

const salmonRecipe = {
  id: salmonId,
  creatorName: "Test",
  creatorImage: "",
  title: "Grilled Salmon with Roasted Vegetables",
  image: "",
  servings: 1,
  calories: 468,
  protein: 42,
  carbs: 28,
  fat: 20,
  isVerified: true,
  savedCount: 0,
  isSaved: false,
};

describe("computeSmartRecipeSuggestions", () => {
  it("returns pool recipes that share ingredients with the plan, excluding meals already on the plan", () => {
    const plan = [
      {
        day: 1,
        meals: [
          {
            name: "Lunch",
            recipeTitle: chickenRecipe.title,
            calories: 542,
            protein: 48,
            carbs: 52,
            fat: 12,
          },
        ],
        totals: { calories: 542, protein: 48, carbs: 52, fat: 12 },
      },
    ];
    const titleToId = (t: string) => (t === chickenRecipe.title ? chickenId : null);
    const dbMap = new Map<string, string[]>([
      [chickenId, ["Chicken breast", "White rice", "Olive oil"]],
      [salmonId, ["Salmon fillet", "Mixed vegetables", "Olive oil"]],
    ]);
    const out = computeSmartRecipeSuggestions({
      mealPlan: plan,
      titleToId,
      dbIngredientsByRecipeId: dbMap,
      extraRecipePool: [salmonRecipe],
    });
    const ids = out.map((s) => s.recipe.id);
    expect(ids).toContain(salmonId);
    expect(ids).not.toContain(chickenId);
    expect(out[0]?.overlapScore).toBeGreaterThan(0);
  });

  it("includes community pool recipes when Supabase ingredient names overlap the plan", () => {
    const communityId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    const plan = [
      {
        day: 1,
        meals: [
          {
            name: "Lunch",
            recipeTitle: "Community Chili",
            calories: 400,
            protein: 30,
            carbs: 40,
            fat: 12,
          },
        ],
        totals: { calories: 400, protein: 30, carbs: 40, fat: 12 },
      },
    ];
    const titleToId = (t: string) => (t === "Community Chili" ? communityId : null);
    const dbMap = new Map<string, string[]>([
      [communityId, ["black beans", "tomato", "onion"]],
      [soupId, ["black beans", "water"]],
    ]);
    const extraRecipePool = [
      {
        id: soupId,
        creatorName: "You",
        creatorImage: "",
        title: "Bean Soup",
        image: "",
        servings: 1,
        calories: 200,
        protein: 12,
        carbs: 28,
        fat: 4,
        isVerified: false,
        savedCount: 0,
        isSaved: true,
      },
    ];
    const out = computeSmartRecipeSuggestions({
      mealPlan: plan,
      titleToId,
      dbIngredientsByRecipeId: dbMap,
      extraRecipePool,
      max: 10,
    });
    const soup = out.find((s) => s.recipe.title === "Bean Soup");
    expect(soup).toBeDefined();
    expect(soup!.sharedIngredients.some((n) => n.toLowerCase().includes("bean"))).toBe(true);
  });

  it("ENG-1634 — scores overlap from shopping-list items and annotates macro fit", () => {
    const plan = [
      {
        day: 1,
        meals: [
          { name: "Breakfast", recipeTitle: "", isPlaceholder: true, calories: 0, protein: 0, carbs: 0, fat: 0 },
          { name: "Lunch", recipeTitle: "", isPlaceholder: true, calories: 0, protein: 0, carbs: 0, fat: 0 },
          { name: "Dinner", recipeTitle: "", isPlaceholder: true, calories: 0, protein: 0, carbs: 0, fat: 0 },
        ],
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      },
    ];
    const dbMap = new Map<string, string[]>([[salmonId, ["Salmon fillet", "Garlic clove", "Jasmine rice"]]]);
    const out = computeSmartRecipeSuggestions({
      mealPlan: plan,
      titleToId: () => null,
      dbIngredientsByRecipeId: dbMap,
      extraRecipePool: [salmonRecipe],
      shoppingListItems: [
        { name: "Garlic clove", amount: "2", unit: "", checked: false },
        { name: "Jasmine rice", amount: "200", unit: "g", checked: false },
      ],
      planTargets: {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 65,
        fiber: 28,
        ...DEFAULT_PLANNER_BANDS,
      },
      rankByMacroFit: true,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.macroFit).toBeDefined();
    expect(out[0]!.sharedIngredients.length).toBeGreaterThanOrEqual(2);
  });
});

describe("collectShoppingListIngredientKeys", () => {
  it("skips checked rows and normalises ingredient names", () => {
    const keys = collectShoppingListIngredientKeys([
      { name: "Garlic clove", amount: "2", unit: "", checked: false },
      { name: "Chicken breast", amount: "1", unit: "", checked: true },
    ]);
    expect(keys.has("garlic clove")).toBe(true);
    expect(keys.has("chicken breast")).toBe(false);
  });
});

describe("findBestPlanSlotForRecipe", () => {
  it("prefers an empty slot on the most calorie-short day", () => {
    const plan = [
      {
        day: 1,
        meals: [
          { name: "Breakfast", recipeTitle: "Oats", calories: 300, protein: 10, carbs: 40, fat: 8 },
          { name: "Lunch", recipeTitle: "", isPlaceholder: true, calories: 0, protein: 0, carbs: 0, fat: 0 },
        ],
        totals: { calories: 300, protein: 10, carbs: 40, fat: 8 },
      },
      {
        day: 2,
        meals: [
          { name: "Breakfast", recipeTitle: "", isPlaceholder: true, calories: 0, protein: 0, carbs: 0, fat: 0 },
          { name: "Lunch", recipeTitle: "", isPlaceholder: true, calories: 0, protein: 0, carbs: 0, fat: 0 },
        ],
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      },
    ];
    const slot = findBestPlanSlotForRecipe({
      mealPlan: plan,
      recipe: salmonRecipe,
      planTargets: {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 65,
        fiber: 28,
        ...DEFAULT_PLANNER_BANDS,
      },
    });
    expect(slot?.dayIndex).toBe(1);
    expect(slot?.mealIndex).toBeGreaterThanOrEqual(0);
  });
});

describe("smartSuggestionMacroFitLabel", () => {
  it("surfaces the short-day copy when dayShortBy is set", () => {
    const label = smartSuggestionMacroFitLabel(
      {
        dayIndex: 1,
        mealIndex: 0,
        slotName: "Lunch",
        calorieDelta: -40,
        band: "close",
        macroFitScore: 0.2,
        dayShortBy: 340,
      },
      "Thursday",
    );
    expect(label).toContain("Thursday");
    expect(label).toContain("340");
  });
});

describe("addRecipeToPlanSlot", () => {
  it("places a recipe into an empty slot and recomputes day totals", () => {
    const plan = [
      {
        day: 1,
        meals: [
          { name: "Lunch", recipeTitle: "", isPlaceholder: true, calories: 0, protein: 0, carbs: 0, fat: 0 },
        ],
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      },
    ];
    const next = addRecipeToPlanSlot({
      plan,
      dayIndex: 0,
      mealIndex: 0,
      recipe: salmonRecipe,
      targets: {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 65,
        fiber: 28,
        ...DEFAULT_PLANNER_BANDS,
      },
      recipePool: [salmonRecipe],
    });
    expect(next[0]!.meals[0]!.recipeTitle).toBe(salmonRecipe.title);
    expect(next[0]!.totals.calories).toBeGreaterThan(0);
  });
});
