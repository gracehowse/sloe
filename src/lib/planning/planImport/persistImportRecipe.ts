import type { SupabaseClient } from "@supabase/supabase-js";
import { normaliseInstructions } from "../../recipes/normaliseInstructions";
import { normalizeRecipeTitle } from "../../recipes/normalizeRecipeTitle";
import { isStructuredSource } from "../../nutrition/structuredSourceGate";
import { matchedAliasKeyForRow } from "../../recipe/matchedAliasPersist";
import {
  IMPORT_ERROR_COPY,
  mapPersistenceError,
} from "../../recipes/importErrorCopy";
import {
  isMatchedAliasColumnMissing,
  withoutMatchedAliasColumn,
} from "./matchedAliasLegacyDb";
import { PLAN_IMPORT_SOURCE_PREFIX } from "./types";
import type { PlanImportNutritionMode, PlanImportVerifiedRecipe } from "./types";

export type PersistImportRecipeResult = { recipeId: string } | { error: string };

/**
 * Insert one imported recipe + ingredients + save row.
 * `collectionLabel` is the plan or cookbook name (becomes `Imported · {name}`).
 */
export async function persistImportRecipe(
  supabase: SupabaseClient,
  userId: string,
  collectionLabel: string,
  recipe: PlanImportVerifiedRecipe,
  mode: PlanImportNutritionMode,
): Promise<PersistImportRecipeResult> {
  const sourceName = `${PLAN_IMPORT_SOURCE_PREFIX}${collectionLabel}`;
  const useAuthor =
    mode === "author" &&
    recipe.authorNutrition?.calories != null &&
    recipe.authorNutrition.calories > 0;
  const macros = useAuthor
    ? {
        calories: Math.round(recipe.authorNutrition!.calories ?? 0),
        protein: Math.round(recipe.authorNutrition!.protein ?? 0),
        carbs: Math.round(recipe.authorNutrition!.carbs ?? 0),
        fat: Math.round(recipe.authorNutrition!.fat ?? 0),
        fiberG: Math.round((recipe.authorNutrition!.fiberG ?? 0) * 10) / 10,
      }
    : recipe.supprNutrition;

  const { data: row, error: insErr } = await supabase
    .from("recipes")
    .insert({
      author_id: userId,
      title: normalizeRecipeTitle(recipe.title),
      instructions: recipe.method ? normaliseInstructions(recipe.method) : null,
      servings: recipe.serves,
      published: false,
      source_name: sourceName,
      source_url: null,
      content_origin: "imported_stub",
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fiber_g: macros.fiberG,
    })
    .select("id")
    .single();

  if (insErr || !row) {
    console.error("[persistImportRecipe] recipe insert failed:", insErr?.message);
    return { error: IMPORT_ERROR_COPY[mapPersistenceError(insErr ?? null)] };
  }

  const recipeId = (row as { id: string }).id;
  const macrosList = recipe.ingredientMacros ?? [];
  if (recipe.ingredients.length > 0) {
    const ingRows = recipe.ingredients.map((name, i) => {
      const m = macrosList[i];
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
        is_verified: isStructuredSource(m?.source),
        source: m?.source ?? null,
        confidence:
          typeof m?.confidence === "number" && Number.isFinite(m.confidence)
            ? m.confidence
            : null,
        // ENG-1276 — carry the matched food id + its alias key (null unless
        // the match is trusted: confidence ≥ 0.85 with source + id present).
        fatsecret_food_id: m?.fatsecretFoodId ?? null,
        matched_alias_key: matchedAliasKeyForRow({
          name,
          source: m?.source,
          fatsecretFoodId: m?.fatsecretFoodId,
          confidence: m?.confidence,
        }),
      };
    });
    let { error: ingErr } = await supabase.from("recipe_ingredients").insert(ingRows);
    if (ingErr && isMatchedAliasColumnMissing(ingErr)) {
      // ENG-1276 legacy-DB tolerance — retry without the staged alias column.
      ({ error: ingErr } = await supabase
        .from("recipe_ingredients")
        .insert(withoutMatchedAliasColumn(ingRows)));
    }
    if (ingErr) {
      await supabase.from("recipes").delete().eq("id", recipeId);
      return { error: IMPORT_ERROR_COPY[mapPersistenceError(ingErr)] };
    }
  }

  const { error: saveErr } = await supabase
    .from("saves")
    .insert({ user_id: userId, recipe_id: recipeId });
  if (saveErr) {
    return { error: IMPORT_ERROR_COPY[mapPersistenceError(saveErr)] };
  }

  return { recipeId };
}
