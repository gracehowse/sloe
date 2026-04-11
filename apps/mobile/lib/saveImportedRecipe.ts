import { supabase } from "@/lib/supabase";

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
};

function normalizeIngredients(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean);
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

  const { data: row, error: insErr } = await supabase
    .from("recipes")
    .insert({
      author_id: userId,
      title,
      description: recipe.description ?? null,
      instructions,
      image_url: recipe.imageUrl ?? null,
      servings,
      prep_time_min: recipe.prepTimeMin ?? null,
      cook_time_min: recipe.cookTimeMin ?? null,
      published: false,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    })
    .select("id")
    .single();

  if (insErr || !row) {
    return { error: insErr?.message ?? "Could not save recipe to your account." };
  }

  const recipeId = (row as { id: string }).id;

  if (ingredients.length > 0) {
    const ingRows = ingredients.map((name) => ({
      recipe_id: recipeId,
      name,
      amount: null as number | null,
      unit: null as string | null,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    }));

    const { error: ingErr } = await supabase.from("recipe_ingredients").insert(ingRows);
    if (ingErr) {
      // Recipe is still usable; ingredients can be edited later on web.
    }
  }

  const { error: saveErr } = await supabase.from("saves").insert({ user_id: userId, recipe_id: recipeId });
  if (saveErr) {
    return { error: saveErr.message ?? "Recipe saved but could not add to library." };
  }

  return { recipeId };
}
