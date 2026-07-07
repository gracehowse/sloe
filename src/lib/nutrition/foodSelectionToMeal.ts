/**
 * Food-selection → meal macros (originally extracted for the ENG-1042 basket
 * teardown; the log-sheet staging basket itself was retired in ENG-1449 —
 * see the one-commit-model note in `apps/mobile/components/today/LogSheet.tsx`
 * — but this scaling core stays as the single source of truth for every
 * commit path).
 *
 * The math that turns a `SelectedFood` / `FoodSearchSelection` (the payload the
 * food-search panel emits on pick) into the scaled per-meal macros + micros was
 * duplicated verbatim between mobile `handleFoodSearchSelect`
 * (`apps/mobile/app/(tabs)/index.tsx`) and web `commitFoodSearchSelection`
 * (`src/app/components/NutritionTracker.tsx`). Extracting it here — pure,
 * shared, one source of truth — keeps every commit path (instant-log on both
 * platforms) byte-for-byte identical.
 *
 * Pure: no React, no Supabase, no `Date`. Mobile imports via
 * `@suppr/shared/nutrition/foodSelectionToMeal`.
 *
 * The per-serving vs per-100g branch is the ENG-745 predicate
 * (`isPerServingPortion`) — kept identical to the preview so what the user sees
 * is what gets logged.
 */

import { isPerServingPortion } from "./foodSearchCore";
import { scaleMicrosForGrams } from "../openFoodFacts/parseOffMicros";
import { scaleMicrosPerServing } from "./scaleMicrosPerServing";
import { scaleCaffeineAlcohol } from "./scaleCaffeineAlcoholForGrams";

/** The minimal selection shape this helper needs — a structural subset of both
 *  the mobile `SelectedFood` and the web `FoodSearchSelection`. */
export type FoodSelectionLike = {
  name: string;
  source: "USDA" | "OFF" | "CUSTOM" | "Edamam" | "FatSecret" | "history" | string;
  macrosPer100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG: number;
    sugarG?: number;
    sodiumMg?: number;
    caffeineMgPer100g?: number | null;
    alcoholGPer100g?: number | null;
  } | null;
  macrosPerServing?: { calories: number; protein: number; carbs: number; fat: number } | null;
  microsPer100g?: Record<string, number>;
  microsPerServing?: Record<string, number>;
  chosenPortion: { label: string; gramWeight: number; servingFraction?: number };
  quantity: number;
  imageUrl?: string | null;
};

/** The platform-neutral scaled core. Each host assembles its own
 *  `JournalMeal` / `LoggedMeal` from these numbers + its slot/time/title. */
export type LoggedMealMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  /** Scaled micros map (fiber/sugar/sodium/caffeine/alcohol/etc.), already
   *  rounded per the shared decimal convention; `{}` when none. */
  micros: Record<string, number>;
};

/**
 * Human-readable journal `source` label for a selection — the attribution the
 * user sees on the logged row. Mirrors the (previously duplicated) mapping in
 * both hosts. A `"history"` re-log is labelled neutrally ("Manual") rather than
 * misattributed to a database source (ENG-1033).
 */
export function foodSelectionSourceLabel(source: FoodSelectionLike["source"]): string {
  switch (source) {
    case "CUSTOM":
      return "Custom food";
    case "OFF":
      return "Open Food Facts";
    case "Edamam":
      return "Edamam";
    case "FatSecret":
      return "FatSecret";
    case "history":
      return "Manual";
    default:
      return "USDA FoodData Central";
  }
}

/** The `food_logged.source` analytics value for a selection (custom vs vendor
 *  search vs re-logged history). */
export function foodSelectionAnalyticsSource(
  source: FoodSelectionLike["source"],
): "custom_food" | "food_search" | "manual" {
  if (source === "CUSTOM") return "custom_food";
  if (source === "history") return "manual";
  switch (source) {
    case "USDA":
    case "OFF":
    case "Edamam":
    case "FatSecret":
      return "food_search";
    default:
      return "food_search";
  }
}

/**
 * Scale a food-search selection into per-meal macros + micros. Single source of
 * truth for every instant-log commit path on both platforms.
 *
 * - **Per-serving path** (FatSecret no-metric / count servings like "1 large
 *   tomato"): `gramWeight === 0` + `macrosPerServing` present →
 *   `macrosPerServing × (quantity × servingFraction)`, micros via
 *   `scaleMicrosPerServing`. No caffeine/alcohol (no per-100g basis).
 * - **Per-100g path**: scale `macrosPer100g` by `grams / 100`; micros via
 *   `scaleMicrosForGrams` + scaled caffeine/alcohol overrides.
 *
 * All outputs are floored at 0 (never negative) and never invented.
 */
export function foodSelectionToMealMacros(selection: FoodSelectionLike): LoggedMealMacros {
  const grams = selection.chosenPortion.gramWeight * selection.quantity;
  const f = grams / 100;

  const perServing = isPerServingPortion({
    gramWeight: selection.chosenPortion.gramWeight,
    hasMacrosPerServing: Boolean(selection.macrosPerServing),
  });

  if (perServing) {
    const ps = selection.macrosPerServing;
    if (!ps) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0, micros: {} };
    }
    const fraction = selection.chosenPortion.servingFraction ?? 1;
    const q = selection.quantity * fraction;
    const micros = scaleMicrosPerServing(selection.microsPerServing, q);
    const fiberFromMicros = micros.fiberG;
    return {
      calories: Math.max(0, Math.round(ps.calories * q)),
      protein: Math.max(0, Math.round(ps.protein * q * 10) / 10),
      carbs: Math.max(0, Math.round(ps.carbs * q * 10) / 10),
      fat: Math.max(0, Math.round(ps.fat * q * 10) / 10),
      fiberG: typeof fiberFromMicros === "number" ? fiberFromMicros : 0,
      micros,
    };
  }

  const m = selection.macrosPer100g;
  if (!m) {
    // Incomplete vendor payload (e.g. OFF 503 / missing nutrition panel) —
    // return zeros instead of throwing so the log path surfaces an Alert
    // rather than reloading the dev client.
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0, micros: {} };
  }
  const { caffeineMg, alcoholG } = scaleCaffeineAlcohol({
    grams,
    caffeineMgPer100g: m.caffeineMgPer100g ?? null,
    alcoholGPer100g: m.alcoholGPer100g ?? null,
  });
  const explicitMicros: Record<string, number> = {};
  if (caffeineMg > 0) explicitMicros.caffeineMg = caffeineMg;
  if (alcoholG > 0) explicitMicros.alcoholG = alcoholG;
  const micros = scaleMicrosForGrams(selection.microsPer100g ?? {}, grams, explicitMicros);

  return {
    calories: Math.max(0, Math.round(m.calories * f)),
    protein: Math.max(0, Math.round(m.protein * f * 10) / 10),
    carbs: Math.max(0, Math.round(m.carbs * f * 10) / 10),
    fat: Math.max(0, Math.round(m.fat * f * 10) / 10),
    fiberG: Math.round(m.fiberG * f * 10) / 10,
    micros,
  };
}
