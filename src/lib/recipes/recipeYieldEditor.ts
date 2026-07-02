/**
 * Recipe yield editor — shared draft + persistence helpers (ENG-736).
 * Web `RecipeEditDialog` + mobile `RecipeEditSheet` import these so
 * structured yield authoring stays aligned across platforms.
 */

import {
  RECIPE_YIELD_GRAMS_MAX,
  RECIPE_YIELD_GRAMS_MIN,
  RECIPE_YIELD_UNITS_MAX,
  RECIPE_YIELD_UNITS_MIN,
  clampRecipeYieldServings,
  parseRecipeYieldDefinition,
  serializeRecipeYieldDefinition,
  type RecipeYieldDefinition,
} from "../nutrition/recipeYield";
import { clampRecipeServings } from "./recipeEdit";

export type RecipeYieldEditorMode =
  | "servings_only"
  | "weight"
  | "units"
  | "weight_and_units";

export type RecipeYieldEditorDraft = {
  mode: RecipeYieldEditorMode;
  servings: number;
  totalGrams: string;
  unitCount: string;
  unitSingular: string;
};

export function recipeYieldEditorModeFromDefinition(
  yieldDef: RecipeYieldDefinition,
): RecipeYieldEditorMode {
  switch (yieldDef.kind) {
    case "weight":
      return "weight";
    case "units":
      return "units";
    case "weight_and_units":
      return "weight_and_units";
    case "servings":
    default:
      return "servings_only";
  }
}

export function recipeYieldEditorDraftFromDb(
  yieldRaw: unknown,
  legacyServings: number,
): RecipeYieldEditorDraft {
  const yieldDef = parseRecipeYieldDefinition(yieldRaw, legacyServings);
  const servings = clampRecipeServings(legacyServings);
  const base: RecipeYieldEditorDraft = {
    mode: recipeYieldEditorModeFromDefinition(yieldDef),
    servings,
    totalGrams: "",
    unitCount: "",
    unitSingular: "",
  };

  switch (yieldDef.kind) {
    case "weight":
      return { ...base, totalGrams: String(yieldDef.totalGrams) };
    case "units":
      return {
        ...base,
        unitCount: String(yieldDef.count),
        unitSingular: yieldDef.singular,
      };
    case "weight_and_units":
      return {
        ...base,
        totalGrams: String(yieldDef.totalGrams),
        unitCount: String(yieldDef.unitCount),
        unitSingular: yieldDef.singular,
      };
    case "servings":
    default:
      return { ...base, servings: clampRecipeYieldServings(yieldDef.count) };
  }
}

function parsePositiveGramsField(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(",", ".").trim());
  if (!Number.isFinite(n) || n < RECIPE_YIELD_GRAMS_MIN) return null;
  return Math.min(RECIPE_YIELD_GRAMS_MAX, Math.round(n * 10) / 10);
}

function parsePositiveUnitsField(raw: string): number | null {
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < RECIPE_YIELD_UNITS_MIN) return null;
  return Math.min(RECIPE_YIELD_UNITS_MAX, n);
}

/** Returns a user-facing validation error, or null when the draft is valid. */
export function validateRecipeYieldEditorDraft(draft: RecipeYieldEditorDraft): string | null {
  if (draft.mode === "servings_only") {
    if (!Number.isFinite(draft.servings) || draft.servings < 1) {
      return "Servings must be at least 1.";
    }
    return null;
  }

  if (draft.mode === "weight" || draft.mode === "weight_and_units") {
    if (parsePositiveGramsField(draft.totalGrams) == null) {
      return `Enter total batch weight (${RECIPE_YIELD_GRAMS_MIN}–${RECIPE_YIELD_GRAMS_MAX} g).`;
    }
  }

  if (draft.mode === "units" || draft.mode === "weight_and_units") {
    if (parsePositiveUnitsField(draft.unitCount) == null) {
      return `Enter how many pieces the batch makes (${RECIPE_YIELD_UNITS_MIN}–${RECIPE_YIELD_UNITS_MAX}).`;
    }
    if (!draft.unitSingular.trim()) {
      return "Name the piece (e.g. slice, bar, muffin).";
    }
  }

  return null;
}

export type RecipeYieldPersistence = {
  servings: number;
  /** Null clears structured yield — legacy servings-only behaviour. */
  yield: Record<string, unknown> | null;
};

/** Build the `recipes.yield` + `recipes.servings` write shape from an editor draft. */
export function buildRecipeYieldPersistence(draft: RecipeYieldEditorDraft): RecipeYieldPersistence {
  const servings = clampRecipeServings(draft.servings);
  const err = validateRecipeYieldEditorDraft(draft);
  if (err) {
    return { servings, yield: null };
  }

  if (draft.mode === "servings_only") {
    return { servings, yield: null };
  }

  let yieldDef: RecipeYieldDefinition;
  if (draft.mode === "weight") {
    const totalGrams = parsePositiveGramsField(draft.totalGrams)!;
    yieldDef = { kind: "weight", totalGrams };
  } else if (draft.mode === "units") {
    const count = parsePositiveUnitsField(draft.unitCount)!;
    const singular = draft.unitSingular.trim();
    yieldDef = parseRecipeYieldDefinition({ kind: "units", count, singular }, servings);
    if (yieldDef.kind !== "units") {
      return { servings, yield: null };
    }
  } else {
    const totalGrams = parsePositiveGramsField(draft.totalGrams)!;
    const unitCount = parsePositiveUnitsField(draft.unitCount)!;
    const singular = draft.unitSingular.trim();
    yieldDef = parseRecipeYieldDefinition(
      { kind: "weight_and_units", totalGrams, unitCount, singular },
      servings,
    );
    if (yieldDef.kind !== "weight_and_units") {
      return { servings, yield: null };
    }
  }

  return {
    servings,
    yield: serializeRecipeYieldDefinition(yieldDef),
  };
}
