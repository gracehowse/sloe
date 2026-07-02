import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyMealType } from "../recipe-import/classifyMealType";
import { paraphraseInstructionsField } from "./normaliseRecipeSteps";
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
  /**
   * ENG-1299 — per-serving micronutrient panel from the verify pipeline
   * (`VerifyResult.microsPerServing`; accept-floor rows already excluded
   * server-side). Canonical `nutrition_micros` camelCase keys. Persisted to
   * `recipes.nutrition_micros`. Absent/empty = no source published micros.
   */
  nutritionMicros?: Record<string, number> | null;
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
    /** ENG-1299 — absolute micros panel at this row's scaled grams. */
    micros?: Record<string, number> | null;
    source?: string;
    confidence?: number;
  }[];
};

/**
 * ENG-1299 — defensive sanitiser for micros maps arriving through API JSON:
 * keep only finite positive numbers so arbitrary payload junk can never
 * reach the jsonb columns. Empty object when nothing survives.
 */
function sanitizeMicros(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = v;
  }
  return out;
}

/**
 * ENG-1299 — true when a Postgres/PostgREST error means the staged
 * `nutrition_micros` migration (20260702127100) has not been applied yet.
 * Import is the viral wedge; it must degrade to "no micros" rather than
 * fail outright on a not-yet-migrated database (same tolerance pattern as
 * `fetchPlannedMealMicros`'s 42703 fallback).
 */
function isMicrosColumnMissing(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  const msg = String((err as { message?: string }).message ?? "");
  return (code === "42703" || code === "PGRST204") && msg.includes("nutrition_micros");
}

/** Strip the ENG-1299 micros column from row payloads (legacy-DB retry). */
function withoutMicrosColumn<T extends { nutrition_micros?: unknown }>(rows: T[]): Omit<T, "nutrition_micros">[] {
  return rows.map((r) => {
    const { nutrition_micros: _dropped, ...rest } = r;
    return rest;
  });
}

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
  // ENG-1128 — legal guardrail at the single persist chokepoint: every
  // imported step (caption / structured-LLM / JSON-LD HTML) is sentence-split
  // + rewritten to neutral imperative voice so a creator's narrative step
  // prose is never stored verbatim. See `normaliseRecipeSteps.ts`.
  return paraphraseInstructionsField(raw);
}

/**
 * ENG-1306 — the single lookup used by both the pre-insert check and the
 * 23505 unique-violation recovery, so both paths resolve the same row the
 * partial unique index guards (imported stubs only — the claim flow can
 * legitimately own a claimed row with the same source_url).
 */
async function findExistingImportBySourceUrl(
  supabase: SupabaseClient,
  userId: string,
  sourceUrl: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("recipes")
    .select("id")
    .eq("author_id", userId)
    .eq("source_url", sourceUrl)
    .eq("content_origin", "imported_stub")
    .limit(1)
    .maybeSingle();
  const id = (existing as { id?: string } | null)?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
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
    const existingId = await findExistingImportBySourceUrl(supabase, userId, sourceUrl);
    if (existingId) return { recipeId: existingId };
  }

  const recipeInsertPayload: Record<string, unknown> = {
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
      content_origin: "imported_stub",
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
      // ENG-1299 — per-serving micros panel from the verify pipeline.
      nutrition_micros: sanitizeMicros(recipe.nutritionMicros),
      caption_nutrition_claim:
        recipe.captionNutrition &&
        (recipe.captionNutrition.caloriesPerServing != null ||
          recipe.captionNutrition.proteinG != null ||
          recipe.captionNutrition.carbsG != null ||
          recipe.captionNutrition.fatG != null)
          ? recipe.captionNutrition
          : null,
  };

  let { data: row, error: insErr } = await supabase
    .from("recipes")
    .insert(recipeInsertPayload)
    .select("id")
    .single();
  if (insErr && isMicrosColumnMissing(insErr)) {
    // ENG-1299 legacy-DB tolerance — retry without the staged column.
    ({ data: row, error: insErr } = await supabase
      .from("recipes")
      .insert(withoutMicrosColumn([recipeInsertPayload as { nutrition_micros?: unknown }])[0]!)
      .select("id")
      .single());
  }

  if (insErr || !row) {
    // ENG-1306 — idempotent re-import. The pre-check above races: two
    // concurrent imports of the same URL both miss it and both insert. The
    // partial unique index recipes_import_author_source_url_unique
    // (author_id, source_url) WHERE content_origin = 'imported_stub' makes
    // the database the arbiter; a 23505 here means the recipe already
    // exists, so return it instead of an error — same contract as the
    // pre-check hit.
    if (sourceUrl && (insErr as { code?: string } | null)?.code === "23505") {
      const existingId = await findExistingImportBySourceUrl(supabase, userId, sourceUrl);
      if (existingId) return { recipeId: existingId };
    }
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
        // ENG-1299 — absolute micros panel at this row's scaled grams.
        nutrition_micros: sanitizeMicros(m?.micros),
        is_verified: isStructuredSource(m?.source),
        source: m?.source ?? null,
        confidence:
          typeof m?.confidence === "number" && Number.isFinite(m.confidence)
            ? m.confidence
            : null,
      };
    });

    let { error: ingErr } = await supabase.from("recipe_ingredients").insert(ingRows);
    if (ingErr && isMicrosColumnMissing(ingErr)) {
      // ENG-1299 legacy-DB tolerance — retry without the staged column.
      ({ error: ingErr } = await supabase
        .from("recipe_ingredients")
        .insert(withoutMicrosColumn(ingRows)));
    }
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

  const recipeUpdatePayload: Record<string, unknown> = {
      title,
      description: recipe.description ?? null,
      instructions,
      image_url: recipe.imageUrl ?? null,
      servings,
      prep_time_min: prepRounded,
      cook_time_min: cookRounded,
      source_url: sourceUrl,
      source_name: sourceName,
      content_origin: "imported_stub",
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
      // ENG-1299 — the refine flow replaces ingredient rows wholesale, so
      // the recipe-level panel is rewritten with them (stale-panel guard).
      nutrition_micros: sanitizeMicros(recipe.nutritionMicros),
      caption_nutrition_claim:
        recipe.captionNutrition &&
        (recipe.captionNutrition.caloriesPerServing != null ||
          recipe.captionNutrition.proteinG != null ||
          recipe.captionNutrition.carbsG != null ||
          recipe.captionNutrition.fatG != null)
          ? recipe.captionNutrition
          : null,
  };

  let { error: updErr } = await supabase
    .from("recipes")
    .update(recipeUpdatePayload)
    .eq("id", recipeId)
    .eq("author_id", userId);
  if (updErr && isMicrosColumnMissing(updErr)) {
    // ENG-1299 legacy-DB tolerance — retry without the staged column.
    ({ error: updErr } = await supabase
      .from("recipes")
      .update(withoutMicrosColumn([recipeUpdatePayload as { nutrition_micros?: unknown }])[0]!)
      .eq("id", recipeId)
      .eq("author_id", userId));
  }

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
        // ENG-1299 — absolute micros panel at this row's scaled grams.
        nutrition_micros: sanitizeMicros(m?.micros),
        is_verified: isStructuredSource(m?.source),
        source: m?.source ?? null,
        confidence:
          typeof m?.confidence === "number" && Number.isFinite(m.confidence)
            ? m.confidence
            : null,
      };
    });

    let { error: ingErr } = await supabase.from("recipe_ingredients").insert(ingRows);
    if (ingErr && isMicrosColumnMissing(ingErr)) {
      // ENG-1299 legacy-DB tolerance — retry without the staged column.
      ({ error: ingErr } = await supabase
        .from("recipe_ingredients")
        .insert(withoutMicrosColumn(ingRows)));
    }
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
