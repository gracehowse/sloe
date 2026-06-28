/**
 * Plan Import — shared commit pipeline (ENG-696).
 *
 * Persists an imported meal plan: optionally saves each parsed recipe to the
 * user's Library, then builds + creates a plan template, then materialises the
 * template into a week's `DayPlan`. Both the web Plan-Import surface
 * (`src/app/components/PlanImport.tsx`) and the mobile flow
 * (`apps/mobile/lib/planImportCommit.ts` → `apps/mobile/app/plan-import.tsx`)
 * call through here so the persistence rules stay byte-identical across
 * platforms — the only difference is which Supabase client they hand in
 * (browser client on web, RN client on mobile).
 *
 * Extracted from the mobile-only `apps/mobile/lib/planImportCommit.ts` during
 * the web-parity build so the pipeline is NOT forked.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { normaliseInstructions } from "../../recipes/normaliseInstructions";
import { normalizeRecipeTitle } from "../../recipes/normalizeRecipeTitle";
import { isStructuredSource } from "../../nutrition/structuredSourceGate";
import { IMPORT_ERROR_COPY, mapPersistenceError } from "../../recipes/importErrorCopy";
import { buildPlanTemplateDraftFromImport } from "./buildPlanTemplateDraft";
import { PLAN_IMPORT_SOURCE_PREFIX } from "./types";
import { createPlanTemplate } from "../../nutrition/planTemplatesClient";
import { applyTemplateToWeek } from "../../nutrition/planTemplates";
import type {
  PlanImportCompiledSlot,
  PlanImportNutritionMode,
  PlanImportVerifiedRecipe,
} from "./types";

export type PlanImportCommitInput = {
  supabase: SupabaseClient;
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
  supabase: SupabaseClient,
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
    })
    .select("id")
    .single();

  if (insErr || !row) {
    console.error("[commitPlanImport] recipe insert failed:", insErr?.message);
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

export async function commitPlanImport(
  input: PlanImportCommitInput,
): Promise<PlanImportCommitResult> {
  const { supabase } = input;
  const recipeIdByKey: Record<string, string> = {};

  if (input.importToLibrary) {
    for (const recipe of input.recipes) {
      const res = await persistImportRecipe(
        supabase,
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
          supabase,
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
