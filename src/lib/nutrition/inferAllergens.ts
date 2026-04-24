/**
 * T12 (full-sweep 2026-04-24) — infer regulated allergens from ingredient
 * lines using keyword matching against the 14-allergen list.
 *
 * **v0 approximation.** Keyword-based matching is imperfect: false
 * positives are possible ("coconut milk" would hit both Milk + Tree
 * nuts without exclusions — handled) and false negatives will happen
 * whenever an allergen is present under a name we didn't list. The
 * contract is:
 *   - Errs toward SURFACING allergens (over-tagging is safer than
 *     under-tagging for a user with a severe allergy — they can
 *     verify with the recipe author / ingredient list).
 *   - Only infers when the underlying ingredient match confidence
 *     meets `MIN_CONFIDENCE` (defaults to 0.70). Low-confidence matches
 *     mean we don't know what the ingredient actually is; guessing its
 *     allergens is worse than staying silent.
 *   - The output is **never a guarantee of safety.** UIs rendering
 *     "Contains: …" must also render a "Not tagged — verify ingredients"
 *     caveat (DI-P0-01 decision doc).
 *
 * Policy: `docs/product/nutrition-approximation-policy.md` (add §A4
 * entry alongside macro coercion + ml=g).
 */

import {
  REGULATED_ALLERGENS,
  type RegulatedAllergenId,
} from "../../constants/regulatedAllergens";

/** Confidence threshold below which an ingredient is ignored for
 *  allergen inference. Matches the recipe-verify policy in
 *  `src/lib/nutrition/verifyIngredients.ts` (0.70 review threshold). */
export const MIN_ALLERGEN_INFERENCE_CONFIDENCE = 0.7;

export interface AllergenInferenceInput {
  /** Ingredient display name (e.g. "coconut milk", "chicken breast"). */
  name: string;
  /** Optional match confidence in [0, 1]. When omitted, the ingredient
   *  is treated as confidence=1 (caller pre-filtered). When below the
   *  threshold the ingredient is skipped. */
  confidence?: number;
}

/**
 * Pure: deterministic substring match against the regulated-allergens
 * keyword table. No I/O. Callers should pre-filter / pre-resolve matches.
 */
export function inferAllergensFromIngredients(
  ingredients: readonly AllergenInferenceInput[] | readonly string[],
  opts?: { minConfidence?: number },
): RegulatedAllergenId[] {
  const minConfidence = opts?.minConfidence ?? MIN_ALLERGEN_INFERENCE_CONFIDENCE;
  const found = new Set<RegulatedAllergenId>();

  for (const ing of ingredients) {
    const entry: AllergenInferenceInput =
      typeof ing === "string" ? { name: ing } : ing;
    const confidence = entry.confidence ?? 1;
    if (!Number.isFinite(confidence) || confidence < minConfidence) continue;
    const haystack = (entry.name ?? "").toLowerCase();
    if (!haystack) continue;
    for (const allergen of REGULATED_ALLERGENS) {
      if (found.has(allergen.id as RegulatedAllergenId)) continue;
      if (!allergen.keywords.some((kw) => haystack.includes(kw))) continue;
      // Exclusion check: if any excluded substring matches, skip.
      if (
        allergen.exclusions?.some((ex) => haystack.includes(ex))
      ) {
        // Re-check keywords minus the excluded span: does any keyword
        // still match OUTSIDE the excluded substring? If the whole
        // match was only the excluded term, skip.
        const withoutExcluded = allergen.exclusions.reduce(
          (acc, ex) => acc.split(ex).join(" "),
          haystack,
        );
        const stillMatches = allergen.keywords.some((kw) => withoutExcluded.includes(kw));
        if (!stillMatches) continue;
      }
      found.add(allergen.id as RegulatedAllergenId);
    }
  }

  // Emit in canonical order (same as the source array) so UIs are stable.
  const order = new Map<string, number>();
  REGULATED_ALLERGENS.forEach((a, i) => order.set(a.id, i));
  return [...found].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}
