/**
 * Single source of truth for ingredient-confidence policy.
 *
 * Pre-P1-8 (2026-04-25), the project shipped four overlapping thresholds
 * across two files:
 *   - `INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD = 0.45` (mean nudge, here)
 *   - `INGREDIENT_VERIFY_REVIEW_MIN_THRESHOLD = 0.20` (min always-nudge, here)
 *   - `RECIPE_INGREDIENT_REVIEW_CONFIDENCE = 0.50` (per-line UI badge,
 *     in `verifyIngredients.ts`, plus a duplicate in
 *     `apps/mobile/lib/verifyRecipe.ts` with a "keep in sync" comment).
 *
 * The mismatch (0.45 mean vs 0.50 per-line) created a silent zone: a
 * recipe whose lines were all at 0.43 confidence got per-line "needs
 * review" badges on every line but **no** recipe-level review CTA,
 * because the mean (0.43) was below 0.45 → wait, that triggers AVG
 * threshold. Actually the silent zone was a recipe averaging 0.46 — the
 * mean cleared the 0.45 nudge but most lines were below the 0.50 per-
 * line bar, so the user saw badges everywhere without a top-level
 * action. Inconsistent UX either way.
 *
 * P1-8 unifies: per-line threshold and mean threshold are both 0.50.
 * That keeps the per-line UI behaviour the team already shipped and
 * raises the mean nudge so a recipe whose every line is "needs review"
 * also gets the recipe-level "review suggested" CTA.
 *
 * Acceptance gates ({@link MIN_ACCEPT_CONFIDENCE} = 0.55, with
 * {@link MIN_MATCH_CONFIDENCE} = 0.55 and {@link MIN_OFF_CONFIDENCE} = 0.57)
 * decide whether to accept a candidate match at all, before any UI threshold
 * applies. ENG-1305 (2026-07-01) moved them HERE from `verifyIngredients.ts`
 * (which still re-exports them) so every floor consumer — the web verify
 * pipeline, `isVerifiedFromVerifyRow`, and the mobile `is_verified` write
 * path via `@suppr/nutrition-core` — reads the SAME constants.
 * D-05 (2026-05-25) proposed 0.70; the nutrition-engine impact review (2026-05-26)
 * shipped 0.55 so verbose-descriptor staples are not over-rejected. The **0.70
 * band** remains the published display/trust signal for "high confidence" in
 * product copy — it is not the live accept floor until ENG-746 piece 2 lands.
 *
 * Note the accept floor (0.55) now sits ABOVE this review badge (0.50).
 *
 * Distinct from `classifyConfidence` in `aiLogging.ts` (logging
 * buckets — different domain).
 */

/**
 * Single tunable accept floor for ingredient matches (ENG-691, Decision D-05,
 * Grace 2026-05-25; value set by the nutrition-engine impact review 2026-05-26).
 *
 * The engine previously accepted down to 0.42 (0.52 OFF) with only a "needs
 * review" badge below — much weaker matches than policy claimed. D-05 proposed
 * raising it to 0.70 (the published "reject < 0.70" band), but the required
 * impact review found 0.70 over-rejects verbose-descriptor staples (brown rice
 * ~0.50, canned tomatoes ~0.46, salmon ~0.36, flour, whole milk ~0.66) — correct
 * matches with multi-word USDA labels, not wrong matches.
 *
 * SHIPPED at 0.55: above 0.42 (still tightens, kills weak dish-word matches)
 * while keeping staples accepted. The 0.70 *band* stays as the display/trust
 * signal (acceptance ≠ display confidence).
 *
 * ENG-746 piece 1 (DONE): the curated genericFoods/genericBeverages tables are
 * now wired as a high-priority exact-alias short-circuit (resolves common
 * staples at 0.95, bypassing the verbose-descriptor penalty). Piece 2 — raising
 * this floor to a genuine 0.70 + re-tuning `confidenceForMatch` for the verbose
 * USDA long-tail — is still open: it has broad blast radius on the recipe-import
 * critical path and needs an empirical over-rejection measurement on a real
 * ingredient corpus before flipping (can't be validated against mocked
 * providers). One knob to re-tune when that validation lands.
 *
 * ENG-1305 (2026-07-01): canonical home moved here from `verifyIngredients.ts`
 * (was defined only in that server-only module, unreachable from mobile) so
 * mobile (via `@suppr/nutrition-core/verifyConfidencePolicy`) and the
 * `is_verified` trust label read the same constant as the accept gate.
 * `is_verified` gates on mobile (`apps/mobile/lib/verifyRecipe.ts`,
 * `apps/mobile/app/recipe/verify.tsx`) now share the exact same floor
 * instead of a hardcoded, drifted 0.5 — that drift meant a 0.5–0.55-
 * confidence match was silently trusted on mobile while the equivalent web
 * row was excluded from totals.
 */
export const MIN_ACCEPT_CONFIDENCE = 0.55;

/**
 * Minimum confidence for USDA / FatSecret name overlap before accepting a match.
 * Raised 0.25 → 0.42 → 0.55 (ENG-691): tightens the accept gate without
 * over-rejecting verbose-descriptor staples (the 0.70 *band* stays the
 * display/trust signal; see {@link MIN_ACCEPT_CONFIDENCE}).
 */
export const MIN_MATCH_CONFIDENCE = MIN_ACCEPT_CONFIDENCE;

/**
 * Minimum confidence for Open Food Facts (stricter — noisy product names).
 * Held one notch above the general floor so OFF stays the strictest source.
 */
export const MIN_OFF_CONFIDENCE = 0.57;

/**
 * Per-line confidence below which the recipe-verify UI shows a "needs
 * review" badge on the line. Raised in P1-8 to share a value with the
 * recipe-level mean nudge so the two surfaces never disagree about a
 * borderline recipe.
 */
export const RECIPE_INGREDIENT_REVIEW_CONFIDENCE = 0.5;

/**
 * Recipe-level mean per-line confidence below this → show "review
 * suggested" messaging at the top of the verify screen (soft nudge,
 * not a hard block). P1-8: bumped 0.45 → 0.50 to match the per-line
 * badge; the previous 0.45 created a silent zone for recipes averaging
 * 0.46–0.50.
 */
export const INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD = RECIPE_INGREDIENT_REVIEW_CONFIDENCE;

/**
 * If any single line falls below this minimum, always nudge review —
 * one bad line can dominate kcal even when the mean looks fine.
 * Unchanged by P1-8.
 */
export const INGREDIENT_VERIFY_REVIEW_MIN_THRESHOLD = 0.2;

/**
 * Display tier for a recipe/ingredient-import confidence average —
 * high / medium / low. ENG-1424: this exact 0.75/0.50 ternary was
 * independently hardcoded in six places (`app/recipe/[id]/page.tsx`,
 * `app/api/plan-import/parse/route.ts`, `app/api/nutrition/refine-log/route.ts`,
 * `app/api/nutrition/verify-recipe/route.ts`, `app/api/nutrition/voice-log/route.ts`,
 * `src/lib/planning/planImport/verifyImportRecipe.ts`)
 * — a silent-drift risk (a value tuned in one copy would leave the other
 * five stale). Centralised here since 0.50 is already this file's
 * {@link RECIPE_INGREDIENT_REVIEW_CONFIDENCE}; only the "high" boundary
 * (0.75) was net-new.
 *
 * Deliberately distinct from `classifyConfidence` in `aiLogging.ts`,
 * which happens to use the same two numbers but for a different
 * confidence signal (the AI model's own confidence in a photo/voice
 * interpretation, not a recipe-ingredient-match average) — see that
 * file's doc comment. Not merged with it; only the five recipe/import
 * sites above are in scope here.
 */
export const RECIPE_CONFIDENCE_TIER_HIGH = 0.75;

export type RecipeConfidenceTier = "high" | "medium" | "low";

export function recipeConfidenceTier(avgConfidence: number): RecipeConfidenceTier {
  if (avgConfidence >= RECIPE_CONFIDENCE_TIER_HIGH) return "high";
  if (avgConfidence >= RECIPE_INGREDIENT_REVIEW_CONFIDENCE) return "medium";
  return "low";
}

/**
 * ENG-1422 — the display tier for an imported recipe, CAPPED by how many lines
 * were excluded from its headline totals.
 *
 * Since ENG-1305, {@link recipeConfidenceTier}'s input average describes the
 * ACCEPTED rows only (the same rows `totals` sum). That makes the raw tier an
 * INVERTED trust signal on the import surfaces: dropping more junk/unmatched
 * lines can RAISE the surviving average, so a MORE incomplete recipe reads at a
 * HIGHER confidence than a fully-matched one. This wrapper removes the
 * inversion by capping the tier on the excluded-line count:
 *
 *   - no excluded lines                     → the raw accepted-average tier
 *     (may be "high").
 *   - some, but under half the recipe        → never "high" — capped at "medium"
 *     (a "low" average still reads "low").
 *   - at least half the recipe's lines gone  → "low" — the headline is missing
 *     at least as much food as it counts, so the surviving matches can't earn
 *     any better than the floor.
 *
 * Invariant (at a fixed accepted-average AND fixed accepted-line count): the
 * returned tier is monotonically NON-INCREASING in `excludedLineCount` —
 * more excluded lines can only hold or lower the displayed tier, never raise
 * it. With a three-value ladder the step can't be strictly-distinct per count,
 * so the guarantee is "never higher", not "always strictly lower".
 *
 * `acceptedLineCount` is the number of rows the average was taken over — rows
 * with macros that cleared {@link MIN_ACCEPT_CONFIDENCE} (i.e. the length of
 * the confidence set the caller averaged into `avgConfidence`).
 */
export function recipeConfidenceTierWithExclusions(
  avgConfidence: number,
  excludedLineCount: number,
  acceptedLineCount: number,
): RecipeConfidenceTier {
  const base = recipeConfidenceTier(avgConfidence);
  const excluded =
    Number.isFinite(excludedLineCount) && excludedLineCount > 0
      ? Math.floor(excludedLineCount)
      : 0;
  if (excluded <= 0) return base;
  const accepted =
    Number.isFinite(acceptedLineCount) && acceptedLineCount > 0
      ? Math.floor(acceptedLineCount)
      : 0;
  // Half or more of the recipe couldn't be matched → the totals are missing at
  // least as much food as they contain → low trust regardless of how clean the
  // surviving matches look. (accepted === 0 with any exclusion lands here too.)
  if (accepted === 0 || excluded >= accepted) return "low";
  // Any excluded line means the totals are incomplete → never claim "high".
  return base === "low" ? "low" : "medium";
}

export function ingredientVerifyNeedsReview(
  avgIngredientConfidence: number | null | undefined,
  minIngredientConfidence: number | null | undefined,
  /**
   * ENG-1305 (2026-07-01): count of rows excluded from recipe totals because
   * they fell below {@link MIN_ACCEPT_CONFIDENCE} (`VerifyResult.
   * belowAcceptFloorCount`). Since ENG-1305 the min/avg stats describe only
   * the ACCEPTED row set (the same rows the totals sum), so excluded rows no
   * longer drag the stats — this parameter is how they still force the
   * review nudge. Any excluded row ⇒ the headline numbers are incomplete ⇒
   * review. Optional so stored-row callers (which compute stats over ALL
   * persisted rows and have no exclusion count) keep their behaviour.
   */
  belowAcceptFloorCount?: number | null,
): boolean {
  if (
    typeof belowAcceptFloorCount === "number" &&
    Number.isFinite(belowAcceptFloorCount) &&
    belowAcceptFloorCount > 0
  ) {
    return true;
  }
  if (
    typeof minIngredientConfidence === "number" &&
    Number.isFinite(minIngredientConfidence) &&
    minIngredientConfidence < INGREDIENT_VERIFY_REVIEW_MIN_THRESHOLD
  ) {
    return true;
  }
  const avg =
    typeof avgIngredientConfidence === "number" && Number.isFinite(avgIngredientConfidence)
      ? avgIngredientConfidence
      : 0;
  if (avg > 0 && avg < INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD) return true;
  return false;
}
