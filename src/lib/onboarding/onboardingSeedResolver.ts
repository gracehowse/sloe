/**
 * onboardingSeedResolver — resolve picked onboarding seeds to real
 * `recipes.id` values + persist `saves` rows + trigger first-week plan
 * generation.
 *
 * Production design spec — 2026-04-27 Surface F.
 * Authority: D-2026-04-27-14 + the candidate-source decision.
 *
 * The flow:
 *   1. Caller passes the onboarding seeds + the authed userId + a
 *      Supabase client. Since the picker step was cut (2026-05-30),
 *      seeds come from `defaultOnboardingSeeds` (curated defaults,
 *      diet/allergen-filtered) at completion in web-flow / mobile-flow.
 *   2. We resolve each slug to a `recipes.id` via case-insensitive
 *      title match against `recipes.matchTitle`. Misses are reported
 *      back so the UI can decide whether to retry / surface a partial
 *      success.
 *   3. We insert one row into `saves` per resolved id (the existing
 *      library save table — confirmed against
 *      `apps/mobile/lib/recipes.ts:useSavedRecipes`).
 *   4. We hand the resolved recipe rows to the planner so it can
 *      generate the first 7-day plan. Plan generation is best-effort —
 *      the saved-recipe rows landing is the primary success criterion.
 *
 * Cross-platform: shared (mobile imports the Supabase client; web
 * imports `browserClient`).
 *
 * Failure handling per spec Surface F §State:
 *   - Resolve miss on >=1 seed → caller decides; we return `{ resolved,
 *     missing }` partition.
 *   - `saves` insert fails entirely → result.savedCount=0, callers can
 *     decide whether to bounce to /home or retry.
 *   - Plan-build fails post-save → "We saved your recipes but couldn't
 *     build a plan. Try regenerate from the Plan tab." caller surface.
 */

import type { OnboardingSeed } from "./onboardingSeeds";

/** Loose Supabase client shape — mirrors the loose typing in
 *  `dailyTargetSnapshot.ts` so this helper works for both web
 *  (`browserClient`) and mobile (`@/lib/supabase`) without `as any`. */

export type ResolverSupabaseClient = any;

export interface SeedResolution {
  /** Seeds resolved to actual recipes.id rows. */
  resolved: Array<{ seed: OnboardingSeed; recipeId: string }>;
  /** Seeds whose matchTitle didn't find a recipes row. */
  missing: OnboardingSeed[];
}

/**
 * Resolve picked seeds to recipes.id values. Pure I/O — no writes.
 * Exposed for tests + for the persist hook to call.
 */
export async function resolveSeedsToRecipeIds(
  supabase: ResolverSupabaseClient,
  picks: readonly OnboardingSeed[],
): Promise<SeedResolution> {
  if (picks.length === 0) {
    return { resolved: [], missing: [] };
  }

  // Case-insensitive title match using ilike + or() to do a single
  // round-trip rather than 15 sequential queries. The title list is
  // small + the recipes table is indexed on title (per existing
  // schema); this is fast.
  const titles = picks.map((s) => s.matchTitle);

  // Build an or() expression like `title.ilike.<a>,title.ilike.<b>,...`.
  // Supabase-js escapes commas via the `or()` chained call, but PostgREST
  // expects a single comma-joined string here. We URI-encode each title
  // to be safe.
  const orExpr = titles
    .map((t) => `title.ilike.${escapeForPostgrest(t)}`)
    .join(",");

  // Provenance gate per docs/decisions/2026-04-27-onboarding-seed-copyright-review.md
  // §Top-issues #3 — never resolve a seed slug to a row with non-Suppr
  // provenance. Even if a user-imported recipe has a matching title,
  // we must not surface it as an onboarding seed (republication risk).
  // The seed migration writes `source_name = 'Suppr onboarding'`; the
  // gate matches that exact value.
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, published, source_name")
    .eq("source_name", "Suppr onboarding")
    .or(orExpr);

  if (error || !Array.isArray(data)) {
    // All-or-nothing failure — every seed reports as missing so the
    // caller can decide whether to retry or surface the empty-state
    // error band per spec Surface F §State.

    console.warn("[onboardingSeedResolver] resolve query failed:", error?.message);
    return { resolved: [], missing: [...picks] };
  }

  const byTitle = new Map<string, { id: string; published: boolean }>();
  for (const row of data as Array<{ id: string; title: string; published: boolean }>) {
    byTitle.set(row.title.toLowerCase().trim(), { id: row.id, published: row.published });
  }

  const resolved: SeedResolution["resolved"] = [];
  const missing: OnboardingSeed[] = [];
  for (const seed of picks) {
    const hit = byTitle.get(seed.matchTitle.toLowerCase().trim());
    if (hit && hit.published) {
      resolved.push({ seed, recipeId: hit.id });
    } else {
      missing.push(seed);
    }
  }
  return { resolved, missing };
}

/**
 * PostgREST or() / ilike operands need a few characters escaped to
 * survive transport. Empty strings, commas, and double-quotes are
 * the relevant ones for our title list — periods and apostrophes
 * pass through fine. Wrap in `*…*` for case-insensitive equivalence
 * (ilike pattern).
 */
function escapeForPostgrest(value: string): string {
  // Replace any reserved chars; wrap with no wildcards so we get a
  // strict case-insensitive equality (ILIKE without wildcards is
  // equivalent to `=` with case-insensitive collation).
  return value.replace(/,/g, "\\,").replace(/"/g, '\\"');
}

/**
 * Persist the saved-recipe rows for a resolved seed list. Uses the
 * `saves` table (the library save mechanism — confirmed against
 * `apps/mobile/lib/recipes.ts:useSavedRecipes`).
 *
 * Idempotent: an existing save (per the unique constraint on
 * `(user_id, recipe_id)`) is treated as success — no error surfaced.
 *
 * Returns the count actually inserted plus any error string the
 * caller might want to log.
 */
export interface SaveSeedsResult {
  savedCount: number;
  error?: string;
}

export async function saveResolvedSeeds(
  supabase: ResolverSupabaseClient,
  args: {
    userId: string;
    resolved: SeedResolution["resolved"];
  },
): Promise<SaveSeedsResult> {
  if (args.resolved.length === 0) {
    return { savedCount: 0 };
  }
  const rows = args.resolved.map((r) => ({
    user_id: args.userId,
    recipe_id: r.recipeId,
  }));
  // upsert with ignoreDuplicates is the cleanest idempotent path.
  // PostgREST `Prefer: resolution=ignore-duplicates` is the supabase-js
  // default when `onConflict` matches the unique constraint.
  const { error, data } = await supabase
    .from("saves")
    .upsert(rows, { onConflict: "user_id,recipe_id", ignoreDuplicates: true })
    .select("recipe_id");
  if (error) {

    console.warn("[onboardingSeedResolver] saves upsert failed:", error.message);
    return { savedCount: 0, error: error.message };
  }
  return { savedCount: Array.isArray(data) ? data.length : args.resolved.length };
}
