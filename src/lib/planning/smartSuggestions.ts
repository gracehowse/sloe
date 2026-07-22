import type { DayPlan, RecipeCard, ShoppingItem } from "../../types/recipe";
import { isMealPlanPlaceholderLikeTitle } from "../nutrition/portionMultiplier";
import { recipeSlotFitScore, slotMacroTargets, type PlannerTargets } from "../nutrition/mealPlanAlgo";
import { normaliseMealSlot } from "../nutrition/mealSlots";
import { normalizeIngredientNameKey } from "./ingredientNameKey";
import { shoppingIngredientHeadline } from "./shoppingQuantityMerge";
import { computePlanWeekSummaryScore } from "./planWeekSummary";

/**
 * Ingredient name keys already required by non-placeholder meals in the plan.
 * Uses DB ingredient names for all recipes.
 */
export function collectPlanIngredientKeys(
  mealPlan: DayPlan[] | null,
  titleToId: (title: string) => string | null,
  dbIngredientsByRecipeId?: ReadonlyMap<string, readonly string[]>,
): Set<string> {
  const keys = new Set<string>();
  if (!mealPlan?.length) return keys;
  for (const day of mealPlan) {
    for (const meal of day.meals) {
      if (isMealPlanPlaceholderLikeTitle(meal.recipeTitle, { isPlaceholder: meal.isPlaceholder })) continue;
      const id = titleToId(meal.recipeTitle);
      if (!id) continue;
      const names = dbIngredientsByRecipeId?.get(id);
      if (names?.length) {
        for (const name of names) {
          const k = normalizeIngredientNameKey(name);
          if (k.length > 1) keys.add(k);
        }
      }
    }
  }
  return keys;
}

/** Ingredient keys from unchecked shopping-list rows (cart-building overlap). */
export function collectShoppingListIngredientKeys(
  items: readonly Pick<ShoppingItem, "name" | "amount" | "unit" | "checked">[],
): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.checked) continue;
    const headline = shoppingIngredientHeadline(item as ShoppingItem);
    const k = normalizeIngredientNameKey(headline);
    if (k.length > 1) keys.add(k);
  }
  return keys;
}

/** Union plan + shopping-list ingredient keys for overlap scoring. */
export function collectOverlapIngredientKeys(input: {
  mealPlan?: DayPlan[] | null;
  titleToId?: (title: string) => string | null;
  dbIngredientsByRecipeId?: ReadonlyMap<string, readonly string[]>;
  shoppingListItems?: readonly Pick<ShoppingItem, "name" | "amount" | "unit" | "checked">[];
}): Set<string> {
  const keys = new Set<string>();
  if (input.mealPlan?.length && input.titleToId) {
    for (const k of collectPlanIngredientKeys(
      input.mealPlan,
      input.titleToId,
      input.dbIngredientsByRecipeId,
    )) {
      keys.add(k);
    }
  }
  if (input.shoppingListItems?.length) {
    for (const k of collectShoppingListIngredientKeys(input.shoppingListItems)) {
      keys.add(k);
    }
  }
  return keys;
}

export type SmartSuggestionMacroFit = {
  dayIndex: number;
  mealIndex: number;
  slotName: string;
  calorieDelta: number;
  band: "tight" | "close" | "loose";
  macroFitScore: number;
  /** When the target day is under calorie target, how many kcal short. */
  dayShortBy?: number;
};

export type SmartSuggestion = {
  recipe: RecipeCard;
  sharedIngredients: string[];
  /** Count of shared ingredient keys (primary rank key). */
  overlapScore: number;
  /** Composite sort key — overlap-led, macro-fit tiebreak. Higher is better. */
  score: number;
  macroFit?: SmartSuggestionMacroFit;
};

export type PlanSlotCandidate = {
  dayIndex: number;
  mealIndex: number;
  slotName: string;
  macroFitScore: number;
  calorieDelta: number;
  band: "tight" | "close" | "loose";
  dayShortBy?: number;
};

function isEmptyPlanSlot(meal: DayPlan["meals"][number] | undefined): boolean {
  if (!meal) return true;
  return isMealPlanPlaceholderLikeTitle(meal.recipeTitle, { isPlaceholder: meal.isPlaceholder });
}

function macroFitBand(calorieDelta: number, targetCalories: number): "tight" | "close" | "loose" {
  if (targetCalories <= 0) return "loose";
  const rel = Math.abs(calorieDelta) / targetCalories;
  if (rel <= 0.05) return "tight";
  if (rel <= 0.15) return "close";
  return "loose";
}

/**
 * Best empty plan slot for a recipe, preferring the week's most calorie-short day.
 */
export function findBestPlanSlotForRecipe(input: {
  mealPlan: DayPlan[] | null;
  recipe: Pick<RecipeCard, "id" | "title" | "calories" | "protein" | "carbs" | "fat" | "fiberG" | "mealSlots">;
  planTargets?: PlannerTargets | null;
}): PlanSlotCandidate | null {
  const { mealPlan, recipe, planTargets } = input;
  if (!mealPlan?.length) return null;

  const summary =
    planTargets && planTargets.calories > 0
      ? computePlanWeekSummaryScore(mealPlan, planTargets.calories)
      : null;
  const preferredDay = summary?.worstShort?.dayIndex ?? null;
  const preferredShortBy = summary?.worstShort?.shortBy;

  const recipeForScore = {
    id: recipe.id,
    title: recipe.title,
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
    fiberG: recipe.fiberG ?? 0,
  };

  let best: PlanSlotCandidate | null = null;

  mealPlan.forEach((day, dayIndex) => {
    const slotNames = day.meals.map((m) => m.name);
    const slotTargets = planTargets
      ? slotMacroTargets(slotNames, planTargets)
      : slotNames.map(() => ({ calories: 400, protein: 30, carbs: 45, fat: 15, fiber: 0 }));

    day.meals.forEach((meal, mealIndex) => {
      if (!isEmptyPlanSlot(meal)) return;
      const slotName = meal.name;
      const canonical = normaliseMealSlot(slotName);
      if (canonical) {
        const tags = recipe.mealSlots ?? [];
        if (tags.length > 0 && !tags.some((t) => normaliseMealSlot(t) === canonical)) {
          return;
        }
      }

      const target = slotTargets[mealIndex]!;
      const macroFitScore = recipeSlotFitScore(recipeForScore, target);
      const calorieDelta = recipe.calories - target.calories;
      const band = macroFitBand(calorieDelta, target.calories);
      const dayShortBy =
        preferredDay === dayIndex && preferredShortBy != null ? preferredShortBy : undefined;

      const candidate: PlanSlotCandidate = {
        dayIndex,
        mealIndex,
        slotName,
        macroFitScore,
        calorieDelta,
        band,
        dayShortBy,
      };

      if (!best) {
        best = candidate;
        return;
      }

      const dayBoost =
        preferredDay === dayIndex && preferredDay !== null ? -0.05 : 0;
      const bestDayBoost =
        preferredDay === best.dayIndex && preferredDay !== null ? -0.05 : 0;
      const aScore = macroFitScore + dayBoost;
      const bScore = best.macroFitScore + bestDayBoost;
      if (aScore < bScore) best = candidate;
    });
  });

  return best;
}

function compositeSuggestionScore(overlap: number, macroFitScore: number | null): number {
  const overlapPart = overlap * 1000;
  const macroPart = macroFitScore != null ? Math.max(0, 1 - macroFitScore) * 100 : 0;
  return overlapPart + macroPart;
}

/**
 * Community recipes that are not already on the plan and share ingredients with
 * plan recipes and/or the shopping list. Ranked by overlap (primary) then macro
 * fit on the week's shortest day (secondary).
 */
export function computeSmartRecipeSuggestions(input: {
  mealPlan: DayPlan[] | null;
  titleToId: (title: string) => string | null;
  max?: number;
  /** Ingredient display names from `recipe_ingredients` keyed by recipe id. */
  dbIngredientsByRecipeId?: ReadonlyMap<string, readonly string[]>;
  /** Saved + discover recipes to include in the suggestion pool. */
  extraRecipePool?: readonly RecipeCard[];
  /** Unchecked shopping-list rows — overlap source when building a cart. */
  shoppingListItems?: readonly Pick<ShoppingItem, "name" | "amount" | "unit" | "checked">[];
  /** Daily targets for macro-fit annotation + secondary ranking. */
  planTargets?: PlannerTargets | null;
  /** When false, skip macro-fit ranking (overlap-only MVP). */
  rankByMacroFit?: boolean;
}): SmartSuggestion[] {
  const max = input.max ?? 6;
  const rankByMacroFit = input.rankByMacroFit ?? true;
  const planKeys = collectOverlapIngredientKeys({
    mealPlan: input.mealPlan,
    titleToId: input.titleToId,
    dbIngredientsByRecipeId: input.dbIngredientsByRecipeId,
    shoppingListItems: input.shoppingListItems,
  });
  if (planKeys.size === 0) return [];

  const titlesOnPlan = new Set<string>();
  for (const d of input.mealPlan ?? []) {
    for (const m of d.meals) {
      if (!isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder })) {
        titlesOnPlan.add(m.recipeTitle);
      }
    }
  }

  const out: SmartSuggestion[] = [];
  const seenIds = new Set<string>();

  const scoreRecipe = (recipe: RecipeCard, ingredientNames: readonly string[]) => {
    if (titlesOnPlan.has(recipe.title)) return;
    const shared: string[] = [];
    for (const name of ingredientNames) {
      const k = normalizeIngredientNameKey(name);
      if (k.length > 1 && planKeys.has(k)) {
        shared.push(name);
      }
    }
    if (shared.length === 0) return;
    if (seenIds.has(recipe.id)) return;
    seenIds.add(recipe.id);

    const overlapScore = shared.length;
    const slot =
      rankByMacroFit && input.mealPlan?.length
        ? findBestPlanSlotForRecipe({
            mealPlan: input.mealPlan,
            recipe,
            planTargets: input.planTargets,
          })
        : null;

    const macroFit: SmartSuggestionMacroFit | undefined = slot
      ? {
          dayIndex: slot.dayIndex,
          mealIndex: slot.mealIndex,
          slotName: slot.slotName,
          calorieDelta: slot.calorieDelta,
          band: slot.band,
          macroFitScore: slot.macroFitScore,
          dayShortBy: slot.dayShortBy,
        }
      : undefined;

    out.push({
      recipe,
      sharedIngredients: shared.slice(0, 8),
      overlapScore,
      score: compositeSuggestionScore(overlapScore, slot?.macroFitScore ?? null),
      macroFit,
    });
  };

  const extra = input.extraRecipePool ?? [];
  for (const recipe of extra) {
    const fromDb = input.dbIngredientsByRecipeId?.get(recipe.id);
    if (fromDb?.length) {
      scoreRecipe(recipe, fromDb);
    }
  }

  out.sort(
    (a, b) =>
      b.score - a.score ||
      b.overlapScore - a.overlapScore ||
      (a.macroFit?.macroFitScore ?? 999) - (b.macroFit?.macroFitScore ?? 999) ||
      a.recipe.title.localeCompare(b.recipe.title),
  );
  return out.slice(0, max);
}

/** User-facing macro-fit line for a suggestion row. */
export function smartSuggestionMacroFitLabel(
  fit: SmartSuggestionMacroFit,
  dayLabel: string,
): string | null {
  if (fit.dayShortBy != null && fit.dayShortBy > 0) {
    return `Fills ${dayLabel} · ~${Math.round(fit.dayShortBy)} kcal short`;
  }
  switch (fit.band) {
    case "tight":
      return `Fits ${dayLabel} ${fit.slotName.toLowerCase()}`;
    case "close":
      return `Close fit for ${dayLabel} ${fit.slotName.toLowerCase()}`;
    default:
      return null;
  }
}
