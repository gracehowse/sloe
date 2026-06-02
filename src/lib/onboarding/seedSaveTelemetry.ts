/**
 * ENG-792 — derive queryable telemetry from a `saveResolvedSeeds` result.
 *
 * Both onboarding flows used to `await saveResolvedSeeds(...)` and discard
 * the result, then report `recipes_resolved` (the resolve-step count) on
 * `onboarding_completed`. So a seed-save upsert failure (RLS rejection,
 * network blip, the tier-lockdown class) left the user at 0 saved recipes
 * while telemetry logged a clean onboarding — indistinguishable from
 * success. This shared helper turns the save result into (a) the real
 * saved count and (b) a failure descriptor, so the signal is identical on
 * web + mobile and can't drift. See `feedback_persist_path_guardrails`.
 */

export type SeedSaveResult = { savedCount: number; error?: string | null };

export type SeedSaveTelemetry = {
  /** Recipes actually persisted — distinct from `recipes_resolved`. */
  recipesSaved: number;
  /** Non-null when the save upsert failed → fire `onboarding_seed_save_failed`. */
  failure: { error: string; attempted: number } | null;
};

/**
 * @param result    the `saveResolvedSeeds` return, or `null` when the save
 *                  step never ran (no resolved seeds to persist).
 * @param attempted how many resolved seeds the save was asked to persist.
 */
export function seedSaveTelemetry(
  result: SeedSaveResult | null | undefined,
  attempted: number,
): SeedSaveTelemetry {
  if (!result) return { recipesSaved: 0, failure: null };
  return {
    recipesSaved: result.savedCount,
    failure: result.error ? { error: result.error, attempted } : null,
  };
}
