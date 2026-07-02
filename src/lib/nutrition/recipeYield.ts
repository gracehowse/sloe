/**
 * Recipe yield — shared helpers for ENG-736 portion-style logging.
 *
 * Recipes store **per-serving** macros (`recipes.calories`, etc.) and a
 * canonical portion count (`recipes.servings`). This module models an
 * optional structured yield (total batch weight, discrete units like
 * slices) and derives per-gram / per-unit macros from the **total batch**
 * without inventing values when yield is unknown.
 *
 * Pure TS — no React, no I/O. Web imports `@/lib/nutrition/recipeYield`;
 * mobile imports `@suppr/nutrition-core/recipeYield`.
 */

import type { PortionUnit, PickerOptions, PortionState } from "./portionPicker";

/** Per-serving macro panel as stored on `recipes`. */
export type RecipeMacroPanel = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
};

/** Legacy servings-only yield — maps to `recipes.servings` today. */
export type RecipeYieldServings = {
  kind: "servings";
  count: number;
};

/** Total batch weight in grams — enables log-by-gram. */
export type RecipeYieldWeight = {
  kind: "weight";
  totalGrams: number;
};

/** Discrete units (slices, bars, …) without a known total weight. */
export type RecipeYieldUnits = {
  kind: "units";
  count: number;
  singular: string;
  plural: string;
};

/** Weight + discrete units — enables gram and per-unit logging. */
export type RecipeYieldWeightAndUnits = {
  kind: "weight_and_units";
  totalGrams: number;
  unitCount: number;
  singular: string;
  plural: string;
};

export type RecipeYieldDefinition =
  | RecipeYieldServings
  | RecipeYieldWeight
  | RecipeYieldUnits
  | RecipeYieldWeightAndUnits;

export const RECIPE_YIELD_SERVINGS_MIN = 1;
export const RECIPE_YIELD_SERVINGS_MAX = 48;
export const RECIPE_YIELD_GRAMS_MIN = 1;
export const RECIPE_YIELD_GRAMS_MAX = 100_000;
export const RECIPE_YIELD_UNITS_MIN = 1;
export const RECIPE_YIELD_UNITS_MAX = 999;

function safeNonNegative(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
}

function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

/** Clamp authored servings into the supported recipe-yield range. */
export function clampRecipeYieldServings(raw: unknown): number {
  return clampInt(raw, RECIPE_YIELD_SERVINGS_MIN, RECIPE_YIELD_SERVINGS_MAX, 1);
}

function clampPositiveGrams(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < RECIPE_YIELD_GRAMS_MIN) return null;
  return Math.min(RECIPE_YIELD_GRAMS_MAX, Math.round(n * 10) / 10);
}

function clampPositiveUnits(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < RECIPE_YIELD_UNITS_MIN) return null;
  return Math.min(RECIPE_YIELD_UNITS_MAX, Math.round(n));
}

function normaliseUnitLabel(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.replace(/\s+/g, " ").trim();
  return trimmed || fallback;
}

function pluralizeUnit(singular: string): string {
  const s = singular.trim();
  if (!s) return s;
  if (/(s|x|z|ch|sh)$/i.test(s)) return `${s}es`;
  if (/[^aeiou]y$/i.test(s)) return `${s.slice(0, -1)}ies`;
  return `${s}s`;
}

/** Scale a macro panel by a linear factor with recipe-consistent rounding. */
export function scaleRecipeMacroPanel(
  panel: RecipeMacroPanel,
  factor: number,
): RecipeMacroPanel {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 0;
  const out: RecipeMacroPanel = {
    calories: Math.round(safeNonNegative(panel.calories) * f),
    protein: roundTo(safeNonNegative(panel.protein) * f, 1),
    carbs: roundTo(safeNonNegative(panel.carbs) * f, 1),
    fat: roundTo(safeNonNegative(panel.fat) * f, 1),
  };
  if (typeof panel.fiberG === "number" && Number.isFinite(panel.fiberG)) {
    out.fiberG = roundTo(safeNonNegative(panel.fiberG) * f, 1);
  }
  return out;
}

/**
 * Total batch macros from per-serving values × authored servings.
 * This is the numerator for per-gram / per-unit derivations.
 */
export function recipeTotalMacrosFromPerServing(
  perServing: RecipeMacroPanel,
  servings: number,
): RecipeMacroPanel {
  const count = clampRecipeYieldServings(servings);
  return scaleRecipeMacroPanel(perServing, count);
}

/** True when the yield definition supports logging by gram weight. */
export function canLogRecipeByGrams(yieldDef: RecipeYieldDefinition): boolean {
  switch (yieldDef.kind) {
    case "weight":
    case "weight_and_units":
      return yieldDef.totalGrams >= RECIPE_YIELD_GRAMS_MIN;
    case "servings":
    case "units":
      return false;
    default: {
      const _exhaustive: never = yieldDef;
      return _exhaustive;
    }
  }
}

/** True when the yield definition supports logging by discrete unit count. */
export function canLogRecipeByUnits(yieldDef: RecipeYieldDefinition): boolean {
  switch (yieldDef.kind) {
    case "units":
      return yieldDef.count >= RECIPE_YIELD_UNITS_MIN;
    case "weight_and_units":
      return yieldDef.unitCount >= RECIPE_YIELD_UNITS_MIN;
    case "servings":
    case "weight":
      return false;
    default: {
      const _exhaustive: never = yieldDef;
      return _exhaustive;
    }
  }
}

/** Gram weight of one discrete unit when both batch weight and unit count are known. */
export function recipeGramsPerUnit(yieldDef: RecipeYieldDefinition): number | null {
  if (yieldDef.kind !== "weight_and_units") return null;
  if (yieldDef.totalGrams <= 0 || yieldDef.unitCount <= 0) return null;
  return yieldDef.totalGrams / yieldDef.unitCount;
}

/**
 * Scale total-batch macros to a gram portion. Returns null when yield
 * does not define a total weight or grams are non-positive.
 */
export function scaleRecipeMacrosByGrams(
  totalMacros: RecipeMacroPanel,
  yieldDef: RecipeYieldDefinition,
  grams: number,
): RecipeMacroPanel | null {
  if (!canLogRecipeByGrams(yieldDef)) return null;
  const totalGrams =
    yieldDef.kind === "weight" || yieldDef.kind === "weight_and_units"
      ? yieldDef.totalGrams
      : null;
  if (totalGrams == null || totalGrams <= 0) return null;
  const g = safeNonNegative(grams);
  if (g <= 0) return null;
  return scaleRecipeMacroPanel(totalMacros, g / totalGrams);
}

/**
 * Scale total-batch macros to a discrete unit count. Returns null when
 * yield does not define units, or when weight+units cannot derive
 * grams-per-unit.
 */
export function scaleRecipeMacrosByUnits(
  totalMacros: RecipeMacroPanel,
  yieldDef: RecipeYieldDefinition,
  units: number,
): RecipeMacroPanel | null {
  if (!canLogRecipeByUnits(yieldDef)) return null;
  const count = safeNonNegative(units);
  if (count <= 0) return null;

  if (yieldDef.kind === "units") {
    if (yieldDef.count <= 0) return null;
    return scaleRecipeMacroPanel(totalMacros, count / yieldDef.count);
  }

  if (yieldDef.kind !== "weight_and_units") return null;

  const gramsPerUnit = recipeGramsPerUnit(yieldDef);
  if (gramsPerUnit == null || gramsPerUnit <= 0) return null;
  const totalGrams = yieldDef.totalGrams;
  if (totalGrams <= 0) return null;
  return scaleRecipeMacroPanel(totalMacros, (count * gramsPerUnit) / totalGrams);
}

/** Scale per-serving macros by a serving count (legacy servings path). */
export function scaleRecipeMacrosByServings(
  perServing: RecipeMacroPanel,
  servings: number,
): RecipeMacroPanel {
  const raw = typeof servings === "number" && Number.isFinite(servings) ? servings : 1;
  const stepped = Math.round(raw * 2) / 2;
  const count = Math.min(8, Math.max(0.5, stepped));
  return scaleRecipeMacroPanel(perServing, count);
}

export type RecipePortionSelection =
  | { mode: "servings"; servings: number }
  | { mode: "grams"; grams: number }
  | { mode: "units"; units: number };

/**
 * Resolve a portion selection to scaled macros. Refuses to guess when the
 * yield does not support the requested mode.
 */
export function scaleRecipePortionMacros(
  perServing: RecipeMacroPanel,
  baseServings: number,
  yieldDef: RecipeYieldDefinition,
  portion: RecipePortionSelection,
): RecipeMacroPanel | null {
  const total = recipeTotalMacrosFromPerServing(perServing, baseServings);
  switch (portion.mode) {
    case "servings":
      return scaleRecipeMacrosByServings(perServing, portion.servings);
    case "grams":
      return scaleRecipeMacrosByGrams(total, yieldDef, portion.grams);
    case "units":
      return scaleRecipeMacrosByUnits(total, yieldDef, portion.units);
    default: {
      const _exhaustive: never = portion;
      return _exhaustive;
    }
  }
}

/**
 * Parse `recipes.yield` jsonb with a fallback to legacy `recipes.servings`.
 * Malformed values degrade to servings-only rather than throwing.
 */
export function parseRecipeYieldDefinition(
  raw: unknown,
  legacyServings: number,
): RecipeYieldDefinition {
  const fallback: RecipeYieldServings = {
    kind: "servings",
    count: clampRecipeYieldServings(legacyServings),
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;

  switch (kind) {
    case "servings": {
      return { kind: "servings", count: clampRecipeYieldServings(o.count ?? legacyServings) };
    }
    case "weight": {
      const totalGrams = clampPositiveGrams(o.totalGrams ?? o.grams);
      if (totalGrams == null) return fallback;
      return { kind: "weight", totalGrams };
    }
    case "units": {
      const count = clampPositiveUnits(o.count ?? o.unitCount);
      const singular = normaliseUnitLabel(o.singular, "unit");
      if (count == null) return fallback;
      const plural = normaliseUnitLabel(o.plural, pluralizeUnit(singular));
      return { kind: "units", count, singular, plural };
    }
    case "weight_and_units": {
      const totalGrams = clampPositiveGrams(o.totalGrams ?? o.grams);
      const unitCount = clampPositiveUnits(o.unitCount ?? o.count);
      const singular = normaliseUnitLabel(o.singular, "unit");
      if (totalGrams == null || unitCount == null) return fallback;
      const plural = normaliseUnitLabel(o.plural, pluralizeUnit(singular));
      return {
        kind: "weight_and_units",
        totalGrams,
        unitCount,
        singular,
        plural,
      };
    }
    default:
      return fallback;
  }
}

/** Serialise a yield definition for `recipes.yield` persistence. */
export function serializeRecipeYieldDefinition(
  yieldDef: RecipeYieldDefinition,
): Record<string, unknown> {
  switch (yieldDef.kind) {
    case "servings":
      return { kind: "servings", count: clampRecipeYieldServings(yieldDef.count) };
    case "weight":
      return { kind: "weight", totalGrams: yieldDef.totalGrams };
    case "units":
      return {
        kind: "units",
        count: yieldDef.count,
        singular: yieldDef.singular,
        plural: yieldDef.plural,
      };
    case "weight_and_units":
      return {
        kind: "weight_and_units",
        totalGrams: yieldDef.totalGrams,
        unitCount: yieldDef.unitCount,
        singular: yieldDef.singular,
        plural: yieldDef.plural,
      };
    default: {
      const _exhaustive: never = yieldDef;
      return _exhaustive;
    }
  }
}

/**
 * Build portion-picker units for a recipe when structured yield enables
 * gram or unit logging. Returns null for servings-only yields — callers
 * keep the legacy serving-multiplier UI.
 */
export function buildRecipeYieldPortionPicker(
  perServing: RecipeMacroPanel,
  baseServings: number,
  yieldDef: RecipeYieldDefinition,
): PickerOptions | null {
  if (!canLogRecipeByGrams(yieldDef)) return null;

  const totalGrams =
    yieldDef.kind === "weight" || yieldDef.kind === "weight_and_units"
      ? yieldDef.totalGrams
      : null;
  if (totalGrams == null || totalGrams <= 0) return null;

  const units: PortionUnit[] = [];

  if (yieldDef.kind === "weight_and_units") {
    const gpu = recipeGramsPerUnit(yieldDef);
    if (gpu != null && gpu > 0) {
      units.push({
        kind: "count",
        singular: yieldDef.singular,
        plural: yieldDef.plural,
        gramsPerUnit: gpu,
      });
    }
  }

  const servingG = totalGrams / clampRecipeYieldServings(baseServings);
  if (servingG > 0) {
    units.push({ kind: "serving", gramsPerServing: servingG });
  }
  units.push({ kind: "gram" });
  units.push({ kind: "ounce" });

  const initial: PortionState = units.find((u) => u.kind === "gram")
    ? { amount: 100, unit: { kind: "gram" } }
    : { amount: 1, unit: units[0]! };

  void recipeTotalMacrosFromPerServing(perServing, baseServings);

  return {
    units,
    quickChips: [],
    initial,
  };
}
