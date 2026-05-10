/**
 * Custom foods — pure helpers (Batch 3.9).
 *
 * Used by both web and mobile so scaling / normalisation can never
 * drift between platforms. No React, no I/O — this file must remain
 * trivially unit-testable.
 *
 * Concepts:
 *  - A `CustomFood` stores macros per `baseGrams` (default 100). To log
 *    a portion, the caller picks either direct grams or a named serving
 *    (e.g. "1 bowl = 80g") × a quantity.
 *  - Scaling is strictly linear. If `baseGrams` is missing or ≤ 0 we
 *    return zeros rather than invent a divisor — this follows the
 *    project rule of never minting nutrition values.
 *  - Servings are de-duped case-insensitively before persistence so a
 *    user cannot save both "1 bowl" and "1 Bowl" with conflicting gram
 *    weights.
 */

/** One named serving shortcut, e.g. `{ label: "1 bowl", grams: 80 }`. */
export type CustomFoodServing = {
  label: string;
  grams: number;
};

/** Provenance of a custom-food row. Most rows are `manual` (entered via
 *  the Create Custom Food form or migrated from legacy data). Photo /
 *  voice correction rows are auto-upserted by the AI-log review path so
 *  the next AI log of the same food uses the user's corrected macros
 *  instead of re-asking the model (user-sentiment audit round 4,
 *  2026-04-30 — Cal AI's failure pattern, MacroFactor's emerging lead). */
export type CustomFoodSource = "manual" | "photo_correction" | "voice_correction";

/** One row of `public.user_custom_foods` in client-friendly shape. */
export type CustomFood = {
  id: string;
  userId: string;
  name: string;
  brand?: string;
  /** Grams the macros below are defined for. Default 100 (nutrition-label convention). */
  baseGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Optional: homemade items often genuinely lack a fiber value. */
  fiber?: number;
  /** Provenance — `manual` by default for legacy rows + the Create
   *  Custom Food form; `photo_correction` / `voice_correction` for
   *  rows auto-upserted from AI-log review corrections. */
  source?: CustomFoodSource;
  /**
   * Natural-portion shortcuts, e.g. `[{"label":"1 slice","grams":30}]`.
   * By convention the first entry — when present — is treated as the
   * canonical natural serving (matches MFP / LoseIt's "1 slice" default).
   */
  servings: CustomFoodServing[];
  /**
   * Optional "servings per container" for packaged foods. Captured
   * verbatim from the label; not derivable from `servings` because the
   * serving array describes natural shortcuts (1 slice, 1 bowl), not
   * package topology. Display-only for now — no calculation branching.
   */
  servingsPerContainer?: number;
  /** Optional detailed micros — grams for sugar / sat fat, mg for sodium.
   * All nullable because a homemade or unlabelled food genuinely may
   * not have these values and we refuse to invent nutrition data. */
  sugarG?: number;
  saturatedFatG?: number;
  sodiumMg?: number;
  /** Optional barcode (8/12/13/14-digit GTIN). Text on purpose — leading
   * zeros matter on UPC-A and we do not coerce to number. */
  barcode?: string;
  createdAt: string;
  updatedAt: string;
};

/** Macros per-portion, optionally including fiber. Mirrors how every
 * other scaler in `src/lib/nutrition/*` returns data. */
export type ScaledCustomMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
};

/** Portion selector shape for `resolvePortionToGrams`. Discriminated
 * union so TS can enforce the right fields at call sites. */
export type CustomFoodPortion =
  | { type: "grams"; grams: number }
  | { type: "serving"; label: string; quantity: number };

/** Shape used by the food-search portion picker on both platforms. Kept
 * loose (no `readonly`) to stay compatible with USDA/OFF portions which
 * are constructed as plain objects. */
export type CustomFoodPortionChip = {
  label: string;
  gramWeight: number;
  amount: number;
};

/** Macros-per-100g shape shared with the food-search UI. Mirrors
 * `src/app/components/FoodSearch.tsx` and `apps/mobile/lib/verifyRecipe.ts`
 * exactly so a custom food can slot into either panel without branching. */
export type CustomFoodMacrosPer100g = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

/** Maximum length of a custom-food name. Matches the DB CHECK. */
export const CUSTOM_FOOD_NAME_MAX = 120;

/**
 * Valid barcode lengths for a custom food: EAN-8, UPC-A (12), EAN-13,
 * GTIN-14. Everything else rejects with an inline error — we never
 * silently drop a bad barcode, because the user's intent is clearly
 * "this is the package" and a mismatched number would silently break
 * the scan-the-same-package path.
 */
export const CUSTOM_FOOD_BARCODE_LENGTHS: ReadonlyArray<number> = [8, 12, 13, 14];

/**
 * Validate + normalise a barcode string. Trims, rejects whitespace in
 * the middle, accepts only pure digits of an allowed length. Empty (or
 * whitespace-only) input returns `{ ok: true, value: undefined }` — the
 * form is optional.
 *
 * Returned shape:
 *  - `ok: true`  — either `value` is a canonical numeric string, or
 *                  `value` is `undefined` meaning "leave unset".
 *  - `ok: false` — `reason` carries the copy the UI can surface inline.
 */
export function validateCustomFoodBarcode(
  raw: string | null | undefined,
): { ok: true; value: string | undefined } | { ok: false; reason: string } {
  if (raw == null) return { ok: true, value: undefined };
  const trimmed = String(raw).trim();
  if (!trimmed) return { ok: true, value: undefined };
  if (!/^\d+$/.test(trimmed)) {
    return {
      ok: false,
      reason: "Enter a valid 8, 12, 13, or 14-digit barcode, or leave blank.",
    };
  }
  if (!CUSTOM_FOOD_BARCODE_LENGTHS.includes(trimmed.length)) {
    return {
      ok: false,
      reason: "Enter a valid 8, 12, 13, or 14-digit barcode, or leave blank.",
    };
  }
  return { ok: true, value: trimmed };
}

function safeNumber(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function safeNonNegative(n: unknown): number {
  const v = safeNumber(n);
  return v >= 0 ? v : 0;
}

function roundTo(n: number, decimals: number): number {
  const m = Math.pow(10, decimals);
  return Math.round(n * m) / m;
}

/**
 * Scale a custom food's macros linearly to the given gram weight.
 *
 * Defensive: if `grams` is zero / negative / non-finite, returns zeros
 * (never NaN, never negative). Same if `baseGrams` is missing or ≤ 0
 * — we refuse to invent a divisor.
 *
 * Fiber is echoed only when the input food has a numeric `fiber`; we
 * do not backfill a fiber value from "close enough" heuristics.
 */
export function scaleMacrosForGrams(
  food: Pick<CustomFood, "baseGrams" | "calories" | "protein" | "carbs" | "fat" | "fiber">,
  grams: number,
): ScaledCustomMacros {
  const base = safeNumber(food.baseGrams);
  const g = safeNumber(grams);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(g) || g <= 0) {
    const out: ScaledCustomMacros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    if (typeof food.fiber === "number" && Number.isFinite(food.fiber)) out.fiber = 0;
    return out;
  }
  const factor = g / base;
  const out: ScaledCustomMacros = {
    calories: Math.round(safeNonNegative(food.calories) * factor),
    protein: roundTo(safeNonNegative(food.protein) * factor, 1),
    carbs: roundTo(safeNonNegative(food.carbs) * factor, 1),
    fat: roundTo(safeNonNegative(food.fat) * factor, 1),
  };
  if (typeof food.fiber === "number" && Number.isFinite(food.fiber)) {
    out.fiber = roundTo(safeNonNegative(food.fiber) * factor, 1);
  }
  return out;
}

/**
 * Resolve a portion selection to a gram weight.
 *
 * `{ type: "grams" }` returns the grams directly (clamped ≥ 0).
 * `{ type: "serving" }` looks up the named serving case-insensitively
 * and returns `grams × quantity`.
 *
 * Throws when `type === "serving"` and the label is not in the food's
 * saved servings. The UI is responsible for only exposing labels the
 * food actually has — but we throw rather than silently fall back to 0
 * so a stale UI can never log 0 kcal by mistake.
 */
export function resolvePortionToGrams(
  food: Pick<CustomFood, "servings">,
  portion: CustomFoodPortion,
): number {
  if (portion.type === "grams") {
    const g = safeNumber(portion.grams);
    return g > 0 ? g : 0;
  }
  const wantedLabel = String(portion.label ?? "").trim().toLowerCase();
  if (!wantedLabel) {
    throw new Error("resolvePortionToGrams: serving label is required");
  }
  const match = (food.servings ?? []).find(
    (s) => String(s.label ?? "").trim().toLowerCase() === wantedLabel,
  );
  if (!match) {
    throw new Error(`resolvePortionToGrams: unknown serving label "${portion.label}"`);
  }
  const grams = safeNumber(match.grams);
  const qty = safeNumber(portion.quantity);
  const q = qty > 0 ? qty : 0;
  if (grams <= 0) return 0;
  return grams * q;
}

/**
 * Normalise a custom-food name for display + dedupe: trim, collapse
 * internal whitespace to single spaces, and cap at `CUSTOM_FOOD_NAME_MAX`
 * characters. Returns an empty string for non-string input.
 */
export function normaliseCustomFoodName(name: string): string {
  if (typeof name !== "string") return "";
  const collapsed = name.replace(/\s+/g, " ").trim();
  if (collapsed.length <= CUSTOM_FOOD_NAME_MAX) return collapsed;
  return collapsed.slice(0, CUSTOM_FOOD_NAME_MAX).trim();
}

/**
 * Project a custom food's macros onto a per-100g basis so the food-search
 * portion picker — which uniformly reasons in `per100g × grams / 100` —
 * can scale it using the same `scaleMacros` path as USDA/OFF results.
 *
 * Defensive: if `baseGrams` is non-finite or ≤ 0 we fall back to 100 so
 * the caller never divides by zero. Fiber / sugar / sodium are echoed as
 * `0` (not omitted) when the food has no saved value so downstream code
 * can rely on the shape; they scale when the user did save them
 * (TestFlight `AE52_fIRZ-ZIupmoJ8T4yaI`). Math deliberately mirrors
 * `scaleMacrosForGrams` rounding so scaled custom foods and edit-preview
 * output agree to the byte.
 */
export function customFoodToMacrosPer100g(
  food: Pick<
    CustomFood,
    | "baseGrams"
    | "calories"
    | "protein"
    | "carbs"
    | "fat"
    | "fiber"
    | "sugarG"
    | "sodiumMg"
  >,
): CustomFoodMacrosPer100g {
  const baseRaw = safeNumber(food.baseGrams);
  const base = Number.isFinite(baseRaw) && baseRaw > 0 ? baseRaw : 100;
  const factor = 100 / base;
  return {
    calories: Math.round(safeNonNegative(food.calories) * factor),
    protein: roundTo(safeNonNegative(food.protein) * factor, 1),
    carbs: roundTo(safeNonNegative(food.carbs) * factor, 1),
    fat: roundTo(safeNonNegative(food.fat) * factor, 1),
    fiberG: typeof food.fiber === "number" && Number.isFinite(food.fiber)
      ? roundTo(safeNonNegative(food.fiber) * factor, 1)
      : 0,
    sugarG:
      typeof food.sugarG === "number" && Number.isFinite(food.sugarG)
        ? roundTo(safeNonNegative(food.sugarG) * factor, 1)
        : 0,
    sodiumMg:
      typeof food.sodiumMg === "number" && Number.isFinite(food.sodiumMg)
        ? Math.round(safeNonNegative(food.sodiumMg) * factor)
        : 0,
  };
}

/** F-156 PR-1 — basis the user is currently entering macros in. */
export type MacroBasis = "per_serving" | "per_100g";

/** F-156 PR-1 — macro values rendered into the form's text fields. */
export type MacroFormValues = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

/**
 * F-156 PR-1 (2026-05-10) — convert macro form values between
 * per-serving and per-100g bases for the basis toggle. Macros are
 * always stored as per-100g internally; this helper drives what the
 * user sees in the input fields when they flip the toggle.
 *
 *  - `from === to` returns the input unchanged.
 *  - `per_serving → per_100g` scales by `100 / servingGrams`.
 *  - `per_100g → per_serving` scales by `servingGrams / 100`.
 *
 * `servingGrams` must be > 0 for a meaningful conversion. If it is
 * zero / negative / non-finite, we return the input unchanged — the
 * caller is responsible for preventing the toggle from being flipped
 * in that state (e.g. require a serving label + grams pair before
 * enabling per-serving). Returning input rather than zeros avoids
 * silently destroying the user's typed values.
 *
 * Rounding mirrors `customFoodToMacrosPer100g` and `scaleMacrosForGrams`
 * so a round-trip through the toggle is stable to the byte (calories +
 * sodium round to integer; protein / carbs / fat / fiber round to 1dp).
 */
export function convertMacrosBetweenBases(
  values: MacroFormValues,
  from: MacroBasis,
  to: MacroBasis,
  servingGrams: number,
): MacroFormValues {
  if (from === to) return values;
  const grams = safeNumber(servingGrams);
  if (!Number.isFinite(grams) || grams <= 0) return values;
  const factor = from === "per_serving" ? 100 / grams : grams / 100;
  return {
    calories: Math.round(safeNonNegative(values.calories) * factor),
    protein: roundTo(safeNonNegative(values.protein) * factor, 1),
    carbs: roundTo(safeNonNegative(values.carbs) * factor, 1),
    fat: roundTo(safeNonNegative(values.fat) * factor, 1),
    fiber: roundTo(safeNonNegative(values.fiber) * factor, 1),
  };
}

/**
 * Build the portion-chip list for a custom food: always grams first,
 * then one chip per saved serving with `gramWeight` == saved grams.
 * Invalid entries (empty label, non-finite or ≤ 0 grams) are silently
 * dropped so a half-saved row never renders a 0 g chip.
 *
 * Runs `dedupeServings` first so the returned list already respects
 * case-insensitive label uniqueness.
 */
export function buildCustomFoodPortions(
  food: Pick<CustomFood, "servings">,
): CustomFoodPortionChip[] {
  const portions: CustomFoodPortionChip[] = [{ label: "g", gramWeight: 1, amount: 1 }];
  const servings = dedupeServings(food.servings ?? []);
  for (const s of servings) {
    portions.push({ label: s.label, gramWeight: s.grams, amount: 1 });
  }
  return portions;
}

/**
 * De-duplicate a list of serving rows:
 *  - trims labels and collapses internal whitespace
 *  - drops rows with empty labels or `grams <= 0`
 *  - dedupes case-insensitively; first occurrence wins
 *
 * Returns a fresh array; never mutates the input.
 */
export function dedupeServings(servings: CustomFoodServing[]): CustomFoodServing[] {
  if (!Array.isArray(servings)) return [];
  const seen = new Set<string>();
  const out: CustomFoodServing[] = [];
  for (const raw of servings) {
    if (!raw || typeof raw !== "object") continue;
    const label = String(raw.label ?? "").replace(/\s+/g, " ").trim();
    const grams = safeNumber(raw.grams);
    if (!label || grams <= 0) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, grams: roundTo(grams, 2) });
  }
  return out;
}

/**
 * Derive the `PrimaryServing` for a custom food from its first saved
 * serving, if any. Connects the TestFlight A2 work (natural-portion
 * default in the picker) with fix B: a custom food saved with
 * `servings: [{label:"1 slice",grams:30}]` surfaces in search with the
 * same primary / secondary display as a Pret sandwich or OFF item.
 *
 * Returns `null` when the food has no valid first serving. Deliberately
 * does not fall back to `baseGrams` — `{"baseGrams":100}` alone is not
 * a natural portion and would re-introduce the "per 100 g" primary line
 * fix A2 removed.
 *
 * Label is echoed verbatim (after trim / whitespace collapse) so
 * "1 slice" stays "1 slice" rather than being lowercased into `1 slice`
 * or prefixed with `"1 "`.
 */
export function customFoodToPrimaryServing(
  food: Pick<
    CustomFood,
    | "baseGrams"
    | "calories"
    | "protein"
    | "carbs"
    | "fat"
    | "fiber"
    | "sugarG"
    | "sodiumMg"
    | "servings"
  >,
): {
  label: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
} | null {
  const cleaned = dedupeServings(food.servings ?? []);
  const first = cleaned[0];
  if (!first) return null;
  const grams = safeNumber(first.grams);
  if (!(grams > 0)) return null;
  const per100g = customFoodToMacrosPer100g(food);
  const factor = grams / 100;
  return {
    label: first.label,
    grams: roundTo(grams, 1),
    kcal: Math.round(per100g.calories * factor),
    protein: roundTo(per100g.protein * factor, 1),
    carbs: roundTo(per100g.carbs * factor, 1),
    fat: roundTo(per100g.fat * factor, 1),
  };
}
