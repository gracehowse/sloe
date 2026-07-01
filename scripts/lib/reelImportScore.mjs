/**
 * reelImportScore — pure scoring for the Reel-import parse-rate benchmark.
 *
 * GROW-61 (recipe-import audit, 2026-07-01) fix #2. Extracted from the harness
 * so the Definition-B classifier is unit-testable in isolation (the harness
 * itself does I/O — fetch + fs — which is not). Pure functions only; no fetch,
 * no fs, no process.
 *
 * The three success definitions the audit asks the harness to report:
 *
 *   A. Recipe-object-returned (the VANITY number) — `ok && ingredients > 0`.
 *      An import "worked" in the loosest sense; says nothing about whether the
 *      macros are usable.
 *
 *   B. Strict success (the LAUNCH GATE, GROW-62) — a USABLE macro-tracked
 *      recipe: `ok` AND ingredients present AND a per-serving calorie spine
 *      AND enough ingredient rows matched a structured catalog with real
 *      macros (>= MATCH_RATE_THRESHOLD).
 *
 *   Caption-present — did the URL even yield extractable caption/recipe text?
 *      Approximated here by "the route returned a recipe object at all"
 *      (`ok && ingredients > 0`): if nothing was extractable the route can't
 *      return ingredients. Quantifies the FM-1 structural ceiling — how much of
 *      the gap is the legal caption-only posture vs the parser.
 *
 * A row "matched with real macros" mirrors the app's `isStructuredSource`
 * gate (USDA / OFF / FatSecret / Edamam) AND `calories > 0`. Kept in sync with
 * `src/lib/nutrition/structuredSourceGate.ts` (the app's persist-layer
 * predicate); the patterns are duplicated here because `.mjs` can't import the
 * TS module, and a drift test in `reelImportScore.test.ts` pins the two.
 */

/** Default strict-match threshold for Definition B. Documented constant: a
 *  usable macro-tracked recipe needs at least this fraction of its ingredient
 *  rows resolved to a structured catalog. 0.7 = "most of the plate is real,
 *  not estimated". Override per-run with `--match-threshold`. */
export const MATCH_RATE_THRESHOLD = 0.7;

/** Structured-catalog source patterns — mirror of
 *  `src/lib/nutrition/structuredSourceGate.ts` STRUCTURED_PATTERNS. */
const STRUCTURED_PATTERNS = [
  /\busda\b/i,
  /\boff\b/i,
  /\bopen\s*food\s*facts\b/i,
  /\bopenfoodfacts\b/i,
  /\bfat\s*secret\b/i,
  /\bfatsecret\b/i,
  /\bedamam\b/i,
];

/** `true` when the source string identifies a structured nutrition catalog. */
export function isStructuredSource(source) {
  if (!source) return false;
  const s = String(source).trim();
  if (!s) return false;
  return STRUCTURED_PATTERNS.some((re) => re.test(s));
}

/** A single ingredient row matched with real macros iff structured source AND
 *  calories > 0. */
export function isMatchedIngredientRow(row) {
  if (!row || typeof row !== "object") return false;
  const calories = typeof row.calories === "number" ? row.calories : 0;
  return calories > 0 && isStructuredSource(row.source);
}

/** Fraction (0..1) of ingredient rows matched to a structured catalog with
 *  real macros. 0 for an empty/missing list. */
export function ingredientMatchRate(recipe) {
  const rows =
    recipe && Array.isArray(recipe.ingredientMacros) ? recipe.ingredientMacros : [];
  if (rows.length === 0) return 0;
  const matched = rows.reduce(
    (acc, row) => acc + (isMatchedIngredientRow(row) ? 1 : 0),
    0,
  );
  return matched / rows.length;
}

function ingredientCount(recipe) {
  return recipe && Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;
}

function perServingCalories(recipe) {
  return recipe && typeof recipe.calories === "number" ? recipe.calories : 0;
}

/**
 * Classify a single `/api/recipe-import` result against all three definitions.
 *
 * @param {object} params
 * @param {boolean} params.ok            — HTTP-level `ok` (2xx AND body.ok)
 * @param {object|null} params.recipe    — the returned `recipe` object (or null)
 * @param {number} [params.threshold]    — Definition-B match threshold
 * @returns {{
 *   definitionA: boolean,        // recipe-object-returned (vanity)
 *   definitionB: boolean,        // strict success — the launch gate
 *   captionPresent: boolean,     // extractable recipe text existed
 *   ingredientCount: number,
 *   perServingCalories: number,
 *   matchRate: number,           // 0..1
 *   failureReason: string|null,  // why B failed (null when B passed)
 * }}
 */
export function classifyImportResult({ ok, recipe, threshold = MATCH_RATE_THRESHOLD }) {
  const ings = ingredientCount(recipe);
  const kcal = perServingCalories(recipe);
  const matchRate = ingredientMatchRate(recipe);

  const definitionA = Boolean(ok) && ings > 0;
  // Caption-present: the route could only return ingredient lines if it had
  // extractable recipe text to work from. This is the structural-ceiling proxy.
  const captionPresent = definitionA;

  let failureReason = null;
  if (!ok) failureReason = "request_failed";
  else if (ings === 0) failureReason = "no_ingredients";
  else if (kcal <= 0) failureReason = "zero_macro_shell";
  else if (matchRate < threshold)
    failureReason = `low_match_rate(${matchRate.toFixed(2)}<${threshold})`;

  const definitionB = failureReason === null;

  return {
    definitionA,
    definitionB,
    captionPresent,
    ingredientCount: ings,
    perServingCalories: kcal,
    matchRate,
    failureReason,
  };
}

/**
 * Aggregate per-URL classifications into the summary block the harness prints.
 * @param {ReturnType<typeof classifyImportResult>[]} rows
 */
export function summarise(rows) {
  const total = rows.length;
  const count = (pred) => rows.filter(pred).length;
  const pct = (n) => (total === 0 ? 0 : Math.round((n / total) * 100));

  const aCount = count((r) => r.definitionA);
  const bCount = count((r) => r.definitionB);
  const captionCount = count((r) => r.captionPresent);

  return {
    total,
    definitionA: { count: aCount, pct: pct(aCount) },
    definitionB: { count: bCount, pct: pct(bCount) },
    captionPresent: { count: captionCount, pct: pct(captionCount) },
  };
}
