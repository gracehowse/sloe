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
 */
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
   * canonical keys the meal-nutrition display reads (`sugarG`, `sodiumMg`).
   * Empty object when no micros are available.
   */
  micros: Record<string, number>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function scaleRecipeMicros(
  recipe: { fiber_g?: number | null; sugar_g?: number | null; sodium_mg?: number | null },
  mult: number,
): PlannedMealMicros {
  const safeMult = Number.isFinite(mult) && mult > 0 ? mult : 1;
  const fiberRaw = recipe.fiber_g;
  const sugarRaw = recipe.sugar_g;
  const sodiumRaw = recipe.sodium_mg;

  const fiberG =
    typeof fiberRaw === "number" && Number.isFinite(fiberRaw) && fiberRaw > 0
      ? Math.round(fiberRaw * safeMult * 10) / 10
      : null;

  const micros: Record<string, number> = {};
  if (typeof sugarRaw === "number" && Number.isFinite(sugarRaw) && sugarRaw > 0) {
    micros.sugarG = Math.round(sugarRaw * safeMult * 10) / 10;
  }
  if (typeof sodiumRaw === "number" && Number.isFinite(sodiumRaw) && sodiumRaw > 0) {
    micros.sodiumMg = Math.round(sodiumRaw * safeMult);
  }

  return { fiberG, micros };
}

export async function fetchPlannedMealMicros(
  supabase: SupabaseLike,
  recipeId: string | null | undefined,
  mult: number,
): Promise<PlannedMealMicros> {
  const empty: PlannedMealMicros = { fiberG: null, micros: {} };
  if (!recipeId || typeof recipeId !== "string" || !UUID_RE.test(recipeId)) return empty;

  try {
    const { data, error } = await supabase
      .from("recipes")
      .select("fiber_g, sugar_g, sodium_mg")
      .eq("id", recipeId)
      .maybeSingle();
    if (error || !data || typeof data !== "object") return empty;
    return scaleRecipeMicros(
      data as { fiber_g?: number | null; sugar_g?: number | null; sodium_mg?: number | null },
      mult,
    );
  } catch {
    return empty;
  }
}
