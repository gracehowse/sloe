/**
 * Map `/api/nutrition/verify-recipe` JSON (spread verify result) and legacy
 * `ingredientRows` shapes into flat per-line macro rows for Supabase + mobile UI.
 *
 * Types are structural only so mobile TypeScript can compile this file without
 * pulling `verifyIngredients` (and its `@/` graph) into the Expo bundle check.
 */

/** Matches `VerifiedMacros` / perServing from the verify pipeline. */
type MacroBlock = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

type VerifiedLike = {
  macros: MacroBlock | null;
  source: string;
  confidence: number;
};

/** One ingredient line after verification (whole-recipe totals per line). */
export type FlatVerifiedMacroRow = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  source: string;
  confidence: number;
};

function macrosFromVerified(v: VerifiedLike): FlatVerifiedMacroRow {
  const m = v.macros;
  if (!m) {
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      source: v.source,
      confidence: v.confidence,
    };
  }
  return {
    calories: Math.max(0, Math.round(Number(m.calories) || 0)),
    protein: Math.max(0, Math.round((Number(m.protein) || 0) * 10) / 10),
    carbs: Math.max(0, Math.round((Number(m.carbs) || 0) * 10) / 10),
    fat: Math.max(0, Math.round((Number(m.fat) || 0) * 10) / 10),
    fiber: Math.max(0, Math.round((Number(m.fiberG) || 0) * 10) / 10),
    sugar: Math.max(0, Math.round((Number(m.sugarG) || 0) * 10) / 10),
    sodium: Math.max(0, Math.round(Number(m.sodiumMg) || 0)),
    source: v.source,
    confidence: typeof v.confidence === "number" ? v.confidence : Number(v.confidence) || 0,
  };
}

function mapLegacyIngredientRows(legacy: unknown[]): FlatVerifiedMacroRow[] {
  return legacy.map((raw) => {
    const r = raw as Record<string, unknown>;
    const m = r.macros as MacroBlock | undefined;
    if (m) {
      return {
        calories: Math.max(0, Math.round(Number(m.calories) || 0)),
        protein: Math.max(0, Math.round((Number(m.protein) || 0) * 10) / 10),
        carbs: Math.max(0, Math.round((Number(m.carbs) || 0) * 10) / 10),
        fat: Math.max(0, Math.round((Number(m.fat) || 0) * 10) / 10),
        fiber: Math.max(0, Math.round((Number(m.fiberG) || 0) * 10) / 10),
        sugar: Math.max(0, Math.round((Number(m.sugarG) || 0) * 10) / 10),
        sodium: Math.max(0, Math.round(Number(m.sodiumMg) || 0)),
        source: String(r.source ?? "Unknown"),
        confidence: typeof r.confidence === "number" ? r.confidence : Number(r.confidence) || 0,
      };
    }
    return {
      calories: Math.max(0, Math.round(Number(r.calories) || 0)),
      protein: Math.max(0, Math.round((Number(r.protein) || 0) * 10) / 10),
      carbs: Math.max(0, Math.round((Number(r.carbs) || 0) * 10) / 10),
      fat: Math.max(0, Math.round((Number(r.fat) || 0) * 10) / 10),
      fiber: Math.max(0, Math.round((Number(r.fiber) || 0) * 10) / 10),
      sugar: Math.max(0, Math.round((Number(r.sugar) || 0) * 10) / 10),
      sodium: Math.max(0, Math.round(Number(r.sodium) || 0)),
      source: String(r.source ?? "Unknown"),
      confidence: typeof r.confidence === "number" ? r.confidence : Number(r.confidence) || 0,
    };
  });
}

/**
 * Normalises both the canonical API shape (`verified[]` + `macros`) and the
 * legacy `ingredientRows[]` from some import routes (`macros` nested).
 *
 * Prefer `verified` whenever it is non-empty so a stray `ingredientRows` key
 * (e.g. empty or stale) cannot shadow real verify output.
 */
export function flatMacroRowsFromVerifyJson(json: Record<string, unknown>): FlatVerifiedMacroRow[] | null {
  const verified = json.verified as VerifiedLike[] | undefined;
  if (Array.isArray(verified) && verified.length > 0) {
    return verified.map(macrosFromVerified);
  }

  const legacy = json.ingredientRows;
  if (Array.isArray(legacy) && legacy.length > 0) {
    return mapLegacyIngredientRows(legacy);
  }

  return null;
}

function macroBlockFromTotals(totals: Partial<MacroBlock>, servings: number): MacroBlock | null {
  const totalCal = Number(totals.calories);
  if (!(servings > 0) || !Number.isFinite(totalCal)) return null;
  return {
    calories: Math.max(0, Math.round(totalCal / servings)),
    protein: Math.max(0, Math.round(((Number(totals.protein) || 0) / servings) * 10) / 10),
    carbs: Math.max(0, Math.round(((Number(totals.carbs) || 0) / servings) * 10) / 10),
    fat: Math.max(0, Math.round(((Number(totals.fat) || 0) / servings) * 10) / 10),
    fiberG: Math.max(0, Math.round(((Number(totals.fiberG) || 0) / servings) * 10) / 10),
    sugarG: Math.max(0, Math.round(((Number(totals.sugarG) || 0) / servings) * 10) / 10),
    sodiumMg: Math.max(0, Math.round((Number(totals.sodiumMg) || 0) / servings)),
  };
}

/**
 * @param servingsHint — when `perServing` is absent, derive from `totals` / servings (request yield).
 */
function macroBlockFromPerServingField(ps: unknown): MacroBlock | null {
  if (!ps || typeof ps !== "object") return null;
  const o = ps as Record<string, unknown>;
  const calories = Number(o.calories);
  if (!Number.isFinite(calories)) return null;
  return {
    calories: Math.max(0, Math.round(calories)),
    protein: Math.max(0, Math.round((Number(o.protein) || 0) * 10) / 10),
    carbs: Math.max(0, Math.round((Number(o.carbs) || 0) * 10) / 10),
    fat: Math.max(0, Math.round((Number(o.fat) || 0) * 10) / 10),
    fiberG: Math.max(0, Math.round((Number(o.fiberG) || 0) * 10) / 10),
    sugarG: Math.max(0, Math.round((Number(o.sugarG) || 0) * 10) / 10),
    sodiumMg: Math.max(0, Math.round(Number(o.sodiumMg) || 0)),
  };
}

export function perServingFromVerifyJson(
  json: Record<string, unknown>,
  options?: { servings?: number },
): MacroBlock | null {
  const fromField = macroBlockFromPerServingField(json.perServing);
  if (fromField) return fromField;

  const totals = json.totals as Partial<MacroBlock> | undefined;
  const fromJson = typeof json.servings === "number" && json.servings > 0 ? json.servings : undefined;
  const srv =
    typeof options?.servings === "number" && options.servings > 0
      ? options.servings
      : fromJson ?? 1;
  if (totals) {
    const derived = macroBlockFromTotals(totals, srv);
    if (derived) return derived;
  }
  return null;
}

import { isStructuredSource } from "./structuredSourceGate";
import { ingredientVerifyNeedsReview, MIN_ACCEPT_CONFIDENCE } from "./verifyConfidencePolicy";

/**
 * Review nudge straight from a raw verify-response JSON (web + mobile).
 *
 * ENG-1305 (2026-07-01): recipe-level min/avg stats describe only ACCEPTED
 * rows (the row set the totals sum), so rows excluded below the accept floor
 * must reach the nudge through `belowAcceptFloorCount`. This helper is the
 * single place that narrows the response fields — call sites pass the parsed
 * JSON as-is.
 */
export function verifyJsonNeedsReview(json: unknown): boolean {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  return ingredientVerifyNeedsReview(
    num(o.avgIngredientConfidence),
    num(o.minIngredientConfidence),
    num(o.belowAcceptFloorCount),
  );
}

/**
 * Whether a verified line should flip `is_verified` in UI + DB.
 *
 * ENG-1305 (2026-07-01): the bar is the shared accept floor
 * ({@link MIN_ACCEPT_CONFIDENCE} = 0.55) instead of a hand-typed 0.5 — a row
 * the pipeline would exclude from recipe totals must never carry the
 * "verified" trust label. Tightening 0.5 → 0.55 only marks fewer rows
 * verified (trust-safe direction).
 */
export function isVerifiedFromVerifyRow(confidence: number, source: string): boolean {
  return (
    isStructuredSource(source) &&
    typeof confidence === "number" &&
    Number.isFinite(confidence) &&
    // ENG-1305: was a hardcoded 0.5, drifted from the 0.55 accept floor
    // used by the main verify pipeline (verifyIngredients.ts).
    confidence >= MIN_ACCEPT_CONFIDENCE
  );
}

/** Merge flat verify rows back onto ingredient rows (index-aligned). */
export function mergeVerifiedMacroRows<T extends Record<string, unknown>>(
  base: T[],
  rows: FlatVerifiedMacroRow[],
): T[] {
  return base.map((ing, i) => {
    const r = rows[i];
    if (!r) return ing;
    return {
      ...ing,
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      fiber_g: r.fiber,
      fiberG: r.fiber,
      sugar_g: r.sugar,
      sugarG: r.sugar,
      sodium_mg: r.sodium,
      sodiumMg: r.sodium,
      confidence: r.confidence,
      source: r.source,
      is_verified: isVerifiedFromVerifyRow(r.confidence, r.source),
      isVerified: isVerifiedFromVerifyRow(r.confidence, r.source),
    };
  });
}

/** Overall numeric confidence for `recipes.verified_confidence` (0–1). */
export function overallConfidenceFromVerifyJson(json: Record<string, unknown>): number | null {
  const a = json.avgIngredientConfidence;
  if (typeof a === "number" && Number.isFinite(a)) return a;
  const o = json.overallConfidence;
  if (typeof o === "number" && Number.isFinite(o)) return o;
  return null;
}
