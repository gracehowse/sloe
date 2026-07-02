/**
 * Fetch fiber + sugar + sodium from a saved recipe and scale them by the
 * portion multiplier used at log-time, so planned-meal → journal entries
 * carry nutrition beyond kcal / P / C / F.
 *
 * `meal_plan_meals` only stores the big-four macros (see migration
 * 20260413100000_relational_user_data.sql). The recipe row on the other
 * hand has `fiber_g` / `sugar_g` / `sodium_mg` populated via the verify
 * flow. Rather than widening the plan schema + backfilling, we look the
 * recipe up at log-time so the journal row carries current nutrition.
 *
 * Returns `null` when `recipeId` is missing, not a UUID, or the fetch
 * fails — callers should fall back to logging with no micros rather
 * than block the insert.
 *
 * T4 (full-sweep 2026-04-24): also returns `macrosAreCoerced` — true
 * when the underlying recipe has stated calories but gram columns that
 * would trigger `coerceMacrosWhenCaloriesButNoGrams`. Journal write
 * paths use this to refuse logging fabricated macros and route the
 * user to the verify screen instead (see the "if nutrition is
 * uncertain, do not guess" project rule).
 */
import { wouldCoerceMacros } from "../nutrition/coerceRecipeMacrosForPlanning";
import { scaleMicrosPerServing } from "../nutrition/scaleMicrosPerServing";

export type SupabaseLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
};

export type PlannedMealMicros = {
  /** Scaled fiber in grams, or null when the recipe didn't publish it. */
  fiberG: number | null;
  /**
   * Micros jsonb payload for `nutrition_entries.nutrition_micros`. Uses the
   * canonical keys the meal-nutrition display reads (`sugarG`, `sodiumMg`,
   * and — since ENG-1299 — the full panel from `recipes.nutrition_micros`:
   * `saturatedFatG`, `cholesterolMg`, `potassiumMg`, vitamins, …).
   * Empty object when no micros are available.
   */
  micros: Record<string, number>;
  /**
   * True when the underlying recipe has calories but the gram columns
   * don't explain them (triggers `coerceMacrosWhenCaloriesButNoGrams`).
   * Journal writers must refuse to persist fabricated P/C/F when this
   * is true — prompt the user to verify the recipe first.
   */
  macrosAreCoerced: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function scaleRecipeMicros(
  recipe: {
    fiber_g?: number | null;
    sugar_g?: number | null;
    sodium_mg?: number | null;
    /** F-74 cross-device (2026-05-08): per-serving caffeine + alcohol
     *  rolled up by the verifier into `recipes.{caffeine_mg,alcohol_g}`.
     *  Closes the planner-tab + recipe-detail "Add to today" gap where
     *  these were silently dropped (per-meal canonical SoT had no
     *  ingredient-aggregate to read). */
    caffeine_mg?: number | null;
    alcohol_g?: number | null;
    /**
     * ENG-1299 — per-serving micronutrient panel from
     * `recipes.nutrition_micros` (canonical camelCase keys). Scaled by the
     * portion multiplier and merged under the columnar keys below so the
     * logged journal entry carries the full panel, like a food log.
     */
    nutrition_micros?: Record<string, unknown> | null;
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
  },
  mult: number,
): PlannedMealMicros {
  const safeMult = Number.isFinite(mult) && mult > 0 ? mult : 1;
  const fiberRaw = recipe.fiber_g;
  const sugarRaw = recipe.sugar_g;
  const sodiumRaw = recipe.sodium_mg;
  const caffeineRaw = recipe.caffeine_mg;
  const alcoholRaw = recipe.alcohol_g;

  const fiberG =
    typeof fiberRaw === "number" && Number.isFinite(fiberRaw) && fiberRaw > 0
      ? Math.round(fiberRaw * safeMult * 10) / 10
      : null;

  // ENG-1299 — start from the recipe's per-serving micros panel scaled by
  // the portion multiplier (same helper + rounding the food-log commit path
  // uses). Non-numeric / non-positive junk in the jsonb is dropped by the
  // scaler. Columnar keys below OVERWRITE panel keys — the columns are the
  // canonical roll-ups for sugar/sodium/caffeine/alcohol and cover rows the
  // panel misses (sources that publish macros but no micros panel).
  const panel: Record<string, number> = {};
  if (recipe.nutrition_micros && typeof recipe.nutrition_micros === "object" && !Array.isArray(recipe.nutrition_micros)) {
    for (const [k, v] of Object.entries(recipe.nutrition_micros)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) panel[k] = v;
    }
  }
  const micros: Record<string, number> = scaleMicrosPerServing(panel, safeMult);
  if (typeof sugarRaw === "number" && Number.isFinite(sugarRaw) && sugarRaw > 0) {
    micros.sugarG = Math.round(sugarRaw * safeMult * 10) / 10;
  }
  if (typeof sodiumRaw === "number" && Number.isFinite(sodiumRaw) && sodiumRaw > 0) {
    micros.sodiumMg = Math.round(sodiumRaw * safeMult);
  }
  if (typeof caffeineRaw === "number" && Number.isFinite(caffeineRaw) && caffeineRaw > 0) {
    micros.caffeineMg = Math.round(caffeineRaw * safeMult);
  }
  if (typeof alcoholRaw === "number" && Number.isFinite(alcoholRaw) && alcoholRaw > 0) {
    micros.alcoholG = Math.round(alcoholRaw * safeMult * 10) / 10;
  }

  const macrosAreCoerced = wouldCoerceMacros({
    calories: Number(recipe.calories) || 0,
    protein: Number(recipe.protein) || 0,
    carbs: Number(recipe.carbs) || 0,
    fat: Number(recipe.fat) || 0,
  });

  return { fiberG, micros, macrosAreCoerced };
}

export async function fetchPlannedMealMicros(
  supabase: SupabaseLike,
  recipeId: string | null | undefined,
  mult: number,
): Promise<PlannedMealMicros> {
  const empty: PlannedMealMicros = { fiberG: null, micros: {}, macrosAreCoerced: false };
  if (!recipeId || typeof recipeId !== "string" || !UUID_RE.test(recipeId)) return empty;

  try {
    const { data, error } = await supabase
      .from("recipes")
      .select("fiber_g, sugar_g, sodium_mg, caffeine_mg, alcohol_g, nutrition_micros, calories, protein, carbs, fat")
      .eq("id", recipeId)
      .maybeSingle();
    if (error) {
      // F-74 cross-device (2026-05-08), extended ENG-1299: if either the
      // caffeine/alcohol or the nutrition_micros migration hasn't been
      // applied yet (PGREST 42703 / "column ... does not exist"), fall
      // back to the minimal legacy column set so the planner /
      // recipe-detail log paths keep working with stale data.
      const code = (error as { code?: string }).code;
      if (code === "42703") {
        const { data: legacy } = await supabase
          .from("recipes")
          .select("fiber_g, sugar_g, sodium_mg, calories, protein, carbs, fat")
          .eq("id", recipeId)
          .maybeSingle();
        if (!legacy || typeof legacy !== "object") return empty;
        return scaleRecipeMicros(
          legacy as Record<string, unknown> & {
            fiber_g?: number | null;
            sugar_g?: number | null;
            sodium_mg?: number | null;
            calories?: number | null;
            protein?: number | null;
            carbs?: number | null;
            fat?: number | null;
          },
          mult,
        );
      }
      return empty;
    }
    if (!data || typeof data !== "object") return empty;
    return scaleRecipeMicros(
      data as {
        fiber_g?: number | null;
        sugar_g?: number | null;
        sodium_mg?: number | null;
        caffeine_mg?: number | null;
        alcohol_g?: number | null;
        nutrition_micros?: Record<string, unknown> | null;
        calories?: number | null;
        protein?: number | null;
        carbs?: number | null;
        fat?: number | null;
      },
      mult,
    );
  } catch {
    return empty;
  }
}
