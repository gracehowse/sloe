/**
 * Recipe fit-percent — 2026-04-20 (re-added).
 *
 * History:
 *   - F-11 (TestFlight `AA63DQ7xd2gRhdjC3L7gjtE`, 2026-04-19) removed
 *     the per-card macro-fit badge because the prior implementation
 *     always rendered "Good" (the underlying `fit` field was never
 *     populated). Tester feedback: "score seems irrelevant".
 *   - 2026-04-20: Grace's design prototype reinstates the badge —
 *     now rendered as a primary-tinted `{N}%` pill top-right of the
 *     hero-card body. The concrete number comes from this helper, so
 *     web + mobile can't drift and a future tester can't see "Good"
 *     on one platform and "82%" on the other.
 *
 * Rules:
 *   - We do NOT guess or invent nutrition values here. The inputs are
 *     the recipe's already-computed single-portion macros and an
 *     optional set of daily macro targets from the user's profile.
 *   - When targets are present and non-zero, we model the meal as
 *     ~1/3 of the day (default 3 meals). Each of the four macros gets
 *     a "how close to the per-meal share" score; we average them and
 *     convert to a percent.
 *   - When targets are absent/zero (e.g. signed-out / fresh profile /
 *     Discover feed called before targets hydrate), we STILL return
 *     a value so every hero card can render a badge — but we pin it
 *     to a stable neutral anchor (`NEUTRAL_FALLBACK`) and surface a
 *     `synthesised: true` flag so callers can label the badge as
 *     approximate if they choose. The prototype only shows the
 *     percent, so callers currently ignore the flag.
 *   - Score is clamped to [40, 100] so a recipe that happens to be
 *     way off a single macro doesn't render a 4% badge and read as
 *     "broken". The floor reflects "this still fits somewhere in the
 *     day, just not optimally"; anything worse is represented by the
 *     floor itself.
 *
 * The score is deterministic: same inputs → same output. Unit-tested
 * via `tests/unit/recipeFitPercent.test.ts`.
 */

export interface RecipeFitInputs {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DailyMacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface RecipeFitResult {
  /** Integer percent in [FLOOR_PERCENT, 100]. */
  percent: number;
  /** True when targets were missing/zero and we fell back to a neutral anchor. */
  synthesised: boolean;
}

/** Baseline "this is a reasonable recipe" percent when we have no targets. */
const NEUTRAL_FALLBACK = 85;
/** Lower clamp so a single-macro mismatch can't drag the badge to 0%. */
const FLOOR_PERCENT = 40;
/** Default meals/day when the caller doesn't specify — 3 meals ≈ 1/3 share. */
const DEFAULT_MEALS_PER_DAY = 3;

function finite(n: number | null | undefined): number {
  return Number.isFinite(n as number) ? (n as number) : 0;
}

function scoreOne(actual: number, perMealTarget: number): number {
  // Symmetric penalty around the per-meal target. `ratio` ∈ [0, ∞);
  // 1.0 is perfect. We convert the absolute log-distance to a 0..1
  // similarity. log(2) ~ 0.69 ≈ a doubling or halving maps to ~0.5.
  if (perMealTarget <= 0 || !Number.isFinite(perMealTarget)) return 1;
  if (actual <= 0) return 0.5; // missing data — middle-of-the-road.
  const ratio = actual / perMealTarget;
  const logDistance = Math.abs(Math.log(ratio));
  // Similarity: 1 at logDistance=0, drops to 0 as logDistance → ~2.
  const similarity = Math.max(0, 1 - logDistance / 2);
  return similarity;
}

/**
 * Compute the fit percent for a recipe card given the user's daily
 * macro targets (or none).
 *
 * @param recipe - per-portion macros for the recipe.
 * @param targets - user's daily macro targets (all four). Pass null
 *                  when targets aren't loaded / user isn't signed in.
 * @param opts.mealsPerDay - default 3. Influences the per-meal share.
 */
export function computeRecipeFitPercent(
  recipe: RecipeFitInputs,
  targets: DailyMacroTargets | null,
  opts?: { mealsPerDay?: number },
): RecipeFitResult {
  const mealsPerDay = Math.max(1, Math.round(opts?.mealsPerDay ?? DEFAULT_MEALS_PER_DAY));
  const c = finite(recipe.calories);
  const p = finite(recipe.protein);
  const cb = finite(recipe.carbs);
  const f = finite(recipe.fat);

  if (!targets || targets.calories <= 0 || targets.protein <= 0 || targets.carbs <= 0 || targets.fat <= 0) {
    return { percent: NEUTRAL_FALLBACK, synthesised: true };
  }

  const perMeal = {
    calories: targets.calories / mealsPerDay,
    protein: targets.protein / mealsPerDay,
    carbs: targets.carbs / mealsPerDay,
    fat: targets.fat / mealsPerDay,
  };

  // Weighted average — protein carries slightly more weight because
  // hitting protein matters more for most users' goals (cutting /
  // body recomp). Weights sum to 1.0.
  const calSim = scoreOne(c, perMeal.calories);
  const proSim = scoreOne(p, perMeal.protein);
  const carbSim = scoreOne(cb, perMeal.carbs);
  const fatSim = scoreOne(f, perMeal.fat);
  const weighted = 0.25 * calSim + 0.4 * proSim + 0.175 * carbSim + 0.175 * fatSim;

  const rawPct = Math.round(weighted * 100);
  const pct = Math.max(FLOOR_PERCENT, Math.min(100, rawPct));
  return { percent: pct, synthesised: false };
}

/**
 * Thin wrapper for cards that don't want to branch on the result —
 * returns just the integer percent (floor applied).
 */
export function recipeFitPercent(
  recipe: RecipeFitInputs,
  targets: DailyMacroTargets | null,
  opts?: { mealsPerDay?: number },
): number {
  return computeRecipeFitPercent(recipe, targets, opts).percent;
}
