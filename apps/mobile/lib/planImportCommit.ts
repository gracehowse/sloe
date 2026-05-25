import { supabase } from "@/lib/supabase";
import { normaliseInstructions } from "@suppr/shared/recipes/normaliseInstructions";
import { normalizeRecipeTitle } from "@suppr/shared/recipes/normalizeRecipeTitle";
import { isStructuredSource } from "@suppr/shared/nutrition/structuredSourceGate";
import {
  IMPORT_ERROR_COPY,
  mapPersistenceError,
} from "@suppr/shared/recipes/importErrorCopy";
import { buildPlanTemplateDraftFromImport } from "@suppr/shared/planning/planImport/buildPlanTemplateDraft";
import { PLAN_IMPORT_SOURCE_PREFIX } from "@suppr/shared/planning/planImport/types";
import { createPlanTemplate } from "@suppr/shared/nutrition/planTemplatesClient";
import { applyTemplateToWeek } from "@suppr/shared/nutrition/planTemplates";
import type {
  PlanImportCompiledSlot,
  PlanImportNutritionMode,
  PlanImportVerifiedRecipe,
} from "@suppr/shared/planning/planImport/types";

export type PlanImportCommitInput = {
  userId: string;
  planName: string;
  recipes: PlanImportVerifiedRecipe[];
  slots: PlanImportCompiledSlot[];
  nutritionMode: PlanImportNutritionMode;
  importToLibrary: boolean;
};

export type PlanImportCommitResult =
  | {
      ok: true;
      templateId: string;
      recipeIdByKey: Record<string, string>;
      dayPlan: ReturnType<typeof applyTemplateToWeek>;
    }
  | { ok: false; error: string };

async function persistImportRecipe(
  userId: string,
  planName: string,
  recipe: PlanImportVerifiedRecipe,
  mode: PlanImportNutritionMode,
): Promise<{ recipeId: string } | { error: string }> {
  const sourceName = `${PLAN_IMPORT_SOURCE_PREFIX}${planName}`;
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
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fiber_g: macros.fiberG,
      is_verified: mode === "match" && recipe.confidence === "high",
    })
    .select("id")
    .single();

  if (insErr || !row) {
    console.error("[planImportCommit] recipe insert failed:", insErr?.message);
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
      };
    });
    const { error: ingErr } = await supabase.from("recipe_ingredients").insert(ingRows);
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

export async function commitPlanImport(input: PlanImportCommitInput): Promise<PlanImportCommitResult> {
  const recipeIdByKey: Record<string, string> = {};

  if (input.importToLibrary) {
    for (const recipe of input.recipes) {
      const res = await persistImportRecipe(
        input.userId,
        input.planName,
        recipe,
        input.nutritionMode,
      );
      if ("error" in res) return { ok: false, error: res.error };
      recipeIdByKey[recipe.key] = res.recipeId;
    }
  } else {
    for (const recipe of input.recipes) {
      if (input.slots.some((s) => s.recipeKeys.includes(recipe.key))) {
        const res = await persistImportRecipe(
          input.userId,
          input.planName,
          recipe,
          input.nutritionMode,
        );
        if ("error" in res) return { ok: false, error: res.error };
        recipeIdByKey[recipe.key] = res.recipeId;
      }
    }
  }

  const draft = buildPlanTemplateDraftFromImport({
    planName: input.planName,
    slots: input.slots,
    recipeIdByKey,
    mode: input.nutritionMode,
  });
  if (!draft) {
    return { ok: false, error: "No linked meals to save. Fix blocked rows or add recipes." };
  }

  const { template, error } = await createPlanTemplate(supabase, input.userId, draft);
  if (error || !template) {
    return { ok: false, error: error ?? "Could not save plan template." };
  }

  const dayPlan = applyTemplateToWeek(template);
  return { ok: true, templateId: template.id, recipeIdByKey, dayPlan };
}
