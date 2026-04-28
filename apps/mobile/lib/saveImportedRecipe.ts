import { supabase } from "@/lib/supabase";
import { classifyMealType } from "./classifyMealType";
import { normaliseInstructions } from "../../../src/lib/recipes/normaliseInstructions";
import { normaliseSource } from "../../../src/lib/recipes/persistSourceAttribution";
import { normalizeRecipeTitle } from "../../../src/lib/recipes/normalizeRecipeTitle";
import { isStructuredSource } from "../../../src/lib/nutrition/structuredSourceGate";

/** Shape returned from `POST /api/recipe-import` (social + HTML paths). */
export type ApiImportedRecipe = {
  title?: string;
  description?: string | null;
  ingredients?: unknown;
  instructions?: unknown;
  imageUrl?: string | null;
  servings?: number | null;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiberG?: number | null;
  sugarG?: number | null;
  sodiumMg?: number | null;
  primarySource?: string | null;
  mealType?: string[] | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  captionNutrition?: {
    caloriesPerServing: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  } | null;
  ingredientMacros?: {
    name: string;
    amount?: string;
    unit?: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG?: number;
    sugarG?: number;
    sodiumMg?: number;
    source?: string;
    /**
     * GW-08 P2 (audit 2026-04-28) — optional per-ingredient match
     * confidence (0..1) from the verify-API matcher. When the
     * importer doesn't surface it, we don't fabricate one — the
     * persisted column stays NULL and the load path's legacy
     * fallback applies.
     */
    confidence?: number;
  }[];
};

function normalizeIngredients(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean);
}

/** Positive minutes from API (number or numeric string); otherwise null. */
export function coercePositiveMinutes(raw: unknown): number | null {
  if (raw == null) return null;
  const n =
    typeof raw === "string"
      ? Number.parseFloat(raw.replace(/,/g, "").trim())
      : typeof raw === "number"
        ? raw
        : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.round(n), 24 * 60);
}

function normalizeInstructions(raw: unknown): string | null {
  if (Array.isArray(raw)) {
    const lines = raw
      .map((x) => normaliseInstructions(String(x)))
      .filter(Boolean);
    return lines.length ? lines.join("\n\n") : null;
  }
  if (typeof raw === "string") {
    const t = normaliseInstructions(raw);
    return t.length ? t : null;
  }
  return null;
}

/**
 * Inserts a private recipe for the user, optional ingredient lines, and a save row so it appears in Library.
 */
export async function saveImportedRecipe(
  userId: string,
  recipe: ApiImportedRecipe,
): Promise<{ recipeId: string } | { error: string }> {
  // Polish (2026-04-25): title-case ALL-CAPS imported titles. Many publisher
  // sites store schema.org `name` in ALL CAPS for visual emphasis; raw
  // pass-through made the whole app read like spam. Helper preserves any
  // author-chosen mixed case ("Banh Mi" stays as-is).
  const title =
    normalizeRecipeTitle(recipe.title) === "Untitled recipe"
      ? "Imported recipe"
      : normalizeRecipeTitle(recipe.title);
  const instructions = normalizeInstructions(recipe.instructions);
  const ingredients = normalizeIngredients(recipe.ingredients);
  const servings =
    typeof recipe.servings === "number" && Number.isFinite(recipe.servings) && recipe.servings > 0
      ? Math.round(recipe.servings)
      : 1;

  const prepRounded = coercePositiveMinutes(
    (recipe as { prep_time_min?: unknown }).prep_time_min ?? recipe.prepTimeMin,
  );
  const cookRounded = coercePositiveMinutes(
    (recipe as { cook_time_min?: unknown }).cook_time_min ?? recipe.cookTimeMin,
  );

  /**
   * Run URL + name through the shared `normaliseSource` helper so every import
   * path persists the same shape (TestFlight `AI-CNKcmy7y`, F-5 fix, 2026-04-19).
   * Human attribution (creator / site). Never use `primarySource` — that is nutrition verification (USDA, etc.).
   */
  const { source_url: sourceUrl, source_name: sourceName } = normaliseSource({
    url: recipe.sourceUrl ?? (recipe as { source_url?: string | null }).source_url ?? null,
    name: recipe.sourceName ?? (recipe as { source_name?: string | null }).source_name ?? null,
  });

  /**
   * 2026-04-26 polish: import-idempotency guard. Tester feedback showed the
   * Library rendering the same recipe twice with different macros — root
   * cause was the same source URL (or same title) being imported by the
   * user multiple times, producing two distinct rows. Now: when the same
   * user already has a recipe with this `source_url`, return its existing
   * id instead of inserting a duplicate row. Skipped when source_url is
   * null (manual create / paste-only flow — no canonical key).
   */
  if (sourceUrl) {
    const { data: existing } = await supabase
      .from("recipes")
      .select("id")
      .eq("author_id", userId)
      .eq("source_url", sourceUrl)
      .limit(1)
      .maybeSingle();
    if (existing && (existing as { id?: string }).id) {
      const existingId = (existing as { id: string }).id;
      // Idempotent: surface success so the caller's "Saved to library"
      // toast still fires; user-facing UX is identical to a fresh import.
      return { recipeId: existingId };
    }
  }

  const { data: row, error: insErr } = await supabase
    .from("recipes")
    .insert({
      author_id: userId,
      title,
      description: recipe.description ?? null,
      instructions,
      image_url: recipe.imageUrl ?? null,
      servings,
      prep_time_min: prepRounded,
      cook_time_min: cookRounded,
      source_url: sourceUrl,
      source_name: sourceName,
      published: false,
      meal_type: recipe.mealType ?? classifyMealType({
        title,
        ingredients,
        caloriesPerServing: recipe.calories ?? undefined,
      }),
      calories: Math.round(recipe.calories ?? 0),
      protein: Math.round(recipe.protein ?? 0),
      carbs: Math.round(recipe.carbs ?? 0),
      fat: Math.round(recipe.fat ?? 0),
      fiber_g: Math.round((recipe.fiberG ?? 0) * 10) / 10,
      sugar_g: Math.round((recipe.sugarG ?? 0) * 10) / 10,
      sodium_mg: Math.round(recipe.sodiumMg ?? 0),
      // Persist the creator's stated per-serving claim (when extractable)
      // so the Verify screen can surface a mismatch banner without having
      // to refetch the caption on every mount.
      caption_nutrition_claim:
        recipe.captionNutrition &&
        (recipe.captionNutrition.caloriesPerServing != null ||
          recipe.captionNutrition.proteinG != null ||
          recipe.captionNutrition.carbsG != null ||
          recipe.captionNutrition.fatG != null)
          ? recipe.captionNutrition
          : null,
    })
    .select("id")
    .single();

  if (insErr || !row) {
    return { error: insErr?.message ?? "Could not save recipe to your account." };
  }

  const recipeId = (row as { id: string }).id;

  if (ingredients.length > 0) {
    const macros = recipe.ingredientMacros ?? [];
    console.log("[saveImport] recipe.calories:", recipe.calories, "ingredientMacros:", macros.length, "first:", JSON.stringify(macros[0]));
    const ingRows = ingredients.map((name, i) => {
      const m = macros[i];
      const amt = m?.amount ? parseFloat(m.amount) : null;
      return {
        recipe_id: recipeId,
        name,
        amount: amt && Number.isFinite(amt) ? amt : null,
        unit: m?.unit ?? null,
        calories: Math.round(m?.calories ?? 0),
        protein: Math.round(m?.protein ?? 0),
        carbs: Math.round(m?.carbs ?? 0),
        fat: Math.round(m?.fat ?? 0),
        fiber_g: Math.round((m?.fiberG ?? 0) * 10) / 10,
        sugar_g: Math.round((m?.sugarG ?? 0) * 10) / 10,
        sodium_mg: Math.round(m?.sodiumMg ?? 0),
        // GW-08 fix (audit 2026-04-28): pre-fix this was
        // `is_verified: (m?.calories ?? 0) > 0` — every successful
        // LLM extract was marked verified, which then propagated
        // through the recipe-level rollup and fed every "USDA
        // verified" / "OFF adjusted" TrustChip across the app. The
        // chip claimed catalog-grade confidence on macros that came
        // straight from the importer prompt. Now gated on whether the
        // macros actually came from a structured catalog (USDA / OFF /
        // FatSecret / Edamam) — see
        // `src/lib/nutrition/structuredSourceGate.ts`.
        is_verified: isStructuredSource(m?.source),
        source: m?.source ?? null,
        // GW-08 P2 (audit 2026-04-28): persist real per-ingredient
        // confidence when the matcher surfaces one. NULL is the
        // honest answer for LLM-only rows — the load path's legacy
        // fallback (0.9 if is_verified else 0.3) applies for those.
        confidence:
          typeof m?.confidence === "number" && Number.isFinite(m.confidence)
            ? m.confidence
            : null,
      };
    });

    const { error: ingErr } = await supabase.from("recipe_ingredients").insert(ingRows);
    if (ingErr) {
      // Ingredient insert failed — delete the orphaned recipe to prevent inconsistent data
      console.error("[saveImport] ingredient insert failed, rolling back recipe:", ingErr.message);
      await supabase.from("recipes").delete().eq("id", recipeId);
      return { error: `Failed to save ingredients: ${ingErr.message}` };
    }
  }

  const { error: saveErr } = await supabase.from("saves").insert({ user_id: userId, recipe_id: recipeId });
  if (saveErr) {
    // Free-tier cap enforcement lives in the `saves_insert_own` RLS
    // policy (see `supabase/migrations/20260426100000_saves_free_tier_cap.sql`).
    // When it fires, Postgres returns code 42501 or a "row-level
    // security" message — surface the user-visible paywall copy so the
    // caller can render a clear prompt rather than a generic failure.
    const msg = (saveErr.message ?? "").toLowerCase();
    const code = (saveErr as { code?: string }).code;
    if (code === "42501" || msg.includes("row-level security") || msg.includes("row level security")) {
      return {
        error: "Free plan is limited to 10 saved recipes. Upgrade to save more.",
      };
    }
    return { error: saveErr.message ?? "Recipe saved but could not add to library." };
  }

  return { recipeId };
}
