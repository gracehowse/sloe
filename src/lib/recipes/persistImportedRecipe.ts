import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyMealType } from "../recipe-import/classifyMealType";
import { normaliseInstructions } from "./normaliseInstructions";
import { normaliseSource } from "./persistSourceAttribution";
import { normalizeRecipeTitle } from "./normalizeRecipeTitle";
import { deriveImportedRecipeTitle } from "./deriveImportedRecipeTitle";
import { isStructuredSource } from "../nutrition/structuredSourceGate";
import {
  IMPORT_ERROR_COPY,
  mapPersistenceError,
} from "./importErrorCopy";

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

function normalizeInstructionsField(raw: unknown): string | null {
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
  supabase: SupabaseClient,
  userId: string,
  recipe: ApiImportedRecipe,
): Promise<{ recipeId: string } | { error: string }> {
  const instructions = normalizeInstructionsField(recipe.instructions);
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

  const { source_url: sourceUrl, source_name: sourceName } = normaliseSource({
    url: recipe.sourceUrl ?? (recipe as { source_url?: string | null }).source_url ?? null,
    name: recipe.sourceName ?? (recipe as { source_name?: string | null }).source_name ?? null,
  });

  const normalizedTitle = normalizeRecipeTitle(recipe.title);
  const title = deriveImportedRecipeTitle({
    sanitizedTitle: normalizedTitle === "Untitled recipe" ? null : normalizedTitle,
    ingredients,
    sourceUrl,
  });

  if (sourceUrl) {
    const { data: existing } = await supabase
      .from("recipes")
      .select("id")
      .eq("author_id", userId)
      .eq("source_url", sourceUrl)
      .limit(1)
      .maybeSingle();
    if (existing && (existing as { id?: string }).id) {
      return { recipeId: (existing as { id: string }).id };
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
    console.error("[saveImport] recipe insert failed:", insErr?.message ?? "no row returned");
    return { error: IMPORT_ERROR_COPY[mapPersistenceError(insErr ?? null)] };
  }

  const recipeId = (row as { id: string }).id;

  if (ingredients.length > 0) {
    const macros = recipe.ingredientMacros ?? [];
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
        is_verified: isStructuredSource(m?.source),
        source: m?.source ?? null,
        confidence:
          typeof m?.confidence === "number" && Number.isFinite(m.confidence)
            ? m.confidence
            : null,
      };
    });

    const { error: ingErr } = await supabase.from("recipe_ingredients").insert(ingRows);
    if (ingErr) {
      console.error("[saveImport] ingredient insert failed, rolling back recipe:", ingErr.message);
      try {
        const { error: rbErr } = await supabase.from("recipes").delete().eq("id", recipeId);
        if (rbErr) {
          console.error("[saveImport] rollback delete failed (orphan recipe row):", rbErr.message, "recipeId:", recipeId);
        }
      } catch (rbCaught) {
        console.error("[saveImport] rollback delete threw (orphan recipe row):", rbCaught instanceof Error ? rbCaught.message : rbCaught, "recipeId:", recipeId);
      }
      return { error: IMPORT_ERROR_COPY[mapPersistenceError(ingErr)] };
    }
  }

  const { error: saveErr } = await supabase.from("saves").insert({ user_id: userId, recipe_id: recipeId });
  if (saveErr) {
    const msg = (saveErr.message ?? "").toLowerCase();
    const code = (saveErr as { code?: string }).code;
    if (code === "42501" || msg.includes("row-level security") || msg.includes("row level security")) {
      return {
        error: "Free plan is limited to 10 saved recipes. Upgrade to save more.",
      };
    }
    console.error("[saveImport] saves-table insert failed:", saveErr.message, "recipeId:", recipeId);
    return { error: IMPORT_ERROR_COPY[mapPersistenceError(saveErr)] };
  }

  return { recipeId };
}

/**
 * ENG-980 — update an import the user refined on the review screen after
 * save-first persistence. Replaces ingredient rows; does not create a new save.
 */
export async function updateImportedRecipe(
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
  recipe: ApiImportedRecipe,
): Promise<{ recipeId: string } | { error: string }> {
  const instructions = normalizeInstructionsField(recipe.instructions);
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

  const { source_url: sourceUrl, source_name: sourceName } = normaliseSource({
    url: recipe.sourceUrl ?? (recipe as { source_url?: string | null }).source_url ?? null,
    name: recipe.sourceName ?? (recipe as { source_name?: string | null }).source_name ?? null,
  });

  const normalizedTitle = normalizeRecipeTitle(recipe.title);
  const title = deriveImportedRecipeTitle({
    sanitizedTitle: normalizedTitle === "Untitled recipe" ? null : normalizedTitle,
    ingredients,
    sourceUrl,
  });

  const { error: updErr } = await supabase
    .from("recipes")
    .update({
      title,
      description: recipe.description ?? null,
      instructions,
      image_url: recipe.imageUrl ?? null,
      servings,
      prep_time_min: prepRounded,
      cook_time_min: cookRounded,
      source_url: sourceUrl,
      source_name: sourceName,
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
      caption_nutrition_claim:
        recipe.captionNutrition &&
        (recipe.captionNutrition.caloriesPerServing != null ||
          recipe.captionNutrition.proteinG != null ||
          recipe.captionNutrition.carbsG != null ||
          recipe.captionNutrition.fatG != null)
          ? recipe.captionNutrition
          : null,
    })
    .eq("id", recipeId)
    .eq("author_id", userId);

  if (updErr) {
    console.error("[saveImport] recipe update failed:", updErr.message, "recipeId:", recipeId);
    return { error: IMPORT_ERROR_COPY[mapPersistenceError(updErr)] };
  }

  const { error: delErr } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId);
  if (delErr) {
    console.error("[saveImport] ingredient delete failed:", delErr.message, "recipeId:", recipeId);
    return { error: IMPORT_ERROR_COPY[mapPersistenceError(delErr)] };
  }

  if (ingredients.length > 0) {
    const macros = recipe.ingredientMacros ?? [];
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
        is_verified: isStructuredSource(m?.source),
        source: m?.source ?? null,
        confidence:
          typeof m?.confidence === "number" && Number.isFinite(m.confidence)
            ? m.confidence
            : null,
      };
    });

    const { error: ingErr } = await supabase.from("recipe_ingredients").insert(ingRows);
    if (ingErr) {
      console.error("[saveImport] ingredient re-insert failed:", ingErr.message, "recipeId:", recipeId);
      return { error: IMPORT_ERROR_COPY[mapPersistenceError(ingErr)] };
    }
  }

  const { error: saveErr } = await supabase
    .from("saves")
    .upsert({ user_id: userId, recipe_id: recipeId }, { onConflict: "user_id,recipe_id" });
  if (saveErr) {
    const msg = (saveErr.message ?? "").toLowerCase();
    const code = (saveErr as { code?: string }).code;
    if (code === "42501" || msg.includes("row-level security") || msg.includes("row level security")) {
      return {
        error: "Free plan is limited to 10 saved recipes. Upgrade to save more.",
      };
    }
    console.error("[saveImport] saves upsert failed:", saveErr.message, "recipeId:", recipeId);
    return { error: IMPORT_ERROR_COPY[mapPersistenceError(saveErr)] };
  }

  return { recipeId };
}
