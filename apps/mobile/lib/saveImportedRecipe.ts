import { supabase } from "@/lib/supabase";
import { classifyMealType } from "./classifyMealType";

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
    const lines = raw.map((x) => String(x).trim()).filter(Boolean);
    return lines.length ? lines.join("\n\n") : null;
  }
  if (typeof raw === "string") {
    const t = raw.trim();
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
  const title = (recipe.title ?? "Imported recipe").trim() || "Imported recipe";
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

  const sourceUrl =
    ((recipe.sourceUrl ?? (recipe as { source_url?: string | null }).source_url) ?? "").trim() || null;
  /** Human attribution (creator / site). Never use `primarySource` — that is nutrition verification (USDA, etc.). */
  const sourceName =
    ((recipe.sourceName ?? (recipe as { source_name?: string | null }).source_name) ?? "").trim() || null;

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
        is_verified: (m?.calories ?? 0) > 0,
        source: m?.source ?? null,
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
    return { error: saveErr.message ?? "Recipe saved but could not add to library." };
  }

  return { recipeId };
}
