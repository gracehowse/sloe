/**
 * Tracking-extras autoupdate (2026-05-02) — central helper that any
 * meal-log commit path can call to bump
 * `profiles.extra_caffeine_by_day` / `profiles.extra_alcohol_g_by_day`
 * by the meal's caffeine + alcohol contribution.
 *
 * Purpose: collapse the 5+ duplicated inline blocks across web
 * (`useNutritionJournalState`) and mobile (`(tabs)/index.tsx`,
 * `barcode.tsx`) so a future change to the bump rule only edits one
 * place. Pre-helper, four mobile log paths bumped correctly
 * (food-search, history-eat-again, planned-meal, barcode) but
 * `insertClonedRowsIntoDay` did not — so duplicating a day that
 * contained "1 espresso" did NOT bump the target day's caffeine
 * total even though the cloned meal's `micros.caffeineMg` survived
 * the clone. Web's bulk-insert primitive `addLoggedMealsForDate`
 * already had the equivalent loop; this helper closes the parity gap
 * and gives both platforms the same one-line invocation.
 *
 * Contract:
 *   - Reads `caffeineMg` / `alcoholG` from `meal.micros`. Top-level
 *     fallback fields (`meal.caffeineMg`, `meal.alcoholG`) are also
 *     accepted so legacy / synthetic shapes (e.g. AI items that may
 *     gain these fields in a future API revision) fit without an
 *     extra adapter.
 *   - 0 / null / non-finite → no-op (skip the round-trip entirely).
 *     `updateStimulantsForDay` already short-circuits a 0 delta but
 *     we also short-circuit here to keep the call site explicit and
 *     to avoid a second read-modify-write when the meal carries no
 *     stimulants at all.
 *   - Positive values → forwarded as-is to `updateStimulantsForDay`
 *     (which clamps + rounds + writes). Negative values are
 *     refused — this helper is for the LOG path only; deletes call
 *     `updateStimulantsForDay` directly with negative deltas.
 *
 * Returns:
 *   - The `UpdateStimulantsResult` from the underlying call when a
 *     write was performed; `{ ok: true, caffeineMg: 0, alcoholG: 0 }`
 *     when the helper short-circuited because no stimulants were
 *     present. Callers can ignore the return value (fire-and-forget
 *     is the canonical pattern, matching the existing inline blocks).
 */

import {
  updateStimulantsForDay,
  type UpdateStimulantsResult,
} from "./updateStimulantsForDay";

type SupabaseLike = Parameters<typeof updateStimulantsForDay>[0];

/**
 * Narrow shape this helper accepts. Both `JournalMeal` (mobile) and
 * `LoggedMeal` (web) fit because both expose `micros` and the helper
 * only reads two well-known keys.
 *
 * `caffeineMg` / `alcoholG` at the top level are accepted as a
 * legacy / synthetic-shape escape hatch. The canonical home for
 * stimulant micros on a journal row is `meal.micros`, mirroring
 * what gets persisted to `nutrition_entries.nutrition_micros`.
 */
export type StimulantBumpInput = {
  micros?: Record<string, number> | null;
  caffeineMg?: number | null;
  alcoholG?: number | null;
};

function readPositive(...candidates: unknown[]): number {
  for (const raw of candidates) {
    if (raw == null) continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/**
 * Read the caffeine + alcohol bump that a meal would contribute.
 * Pure helper — exposed for tests and for callers that want to log
 * the values before / after the bump fires.
 */
export function readStimulantBumpFromMeal(meal: StimulantBumpInput): {
  caffeineMg: number;
  alcoholG: number;
} {
  const caffeineMg = readPositive(meal.micros?.caffeineMg, meal.caffeineMg);
  const alcoholG = readPositive(meal.micros?.alcoholG, meal.alcoholG);
  return { caffeineMg, alcoholG };
}

/**
 * Read the combined caffeine + alcohol bump across an array of meals
 * so a bulk insert (`insertClonedRowsIntoDay`, `addLoggedMealsForDate`,
 * `commitAiLoggedItems`) can fire ONE supabase round-trip instead of
 * N. Mirrors the inline loop the web bulk path already uses.
 */
export function readStimulantBumpFromMeals(meals: ReadonlyArray<StimulantBumpInput>): {
  caffeineMg: number;
  alcoholG: number;
} {
  let caffeineMg = 0;
  let alcoholG = 0;
  for (const m of meals) {
    const { caffeineMg: c, alcoholG: a } = readStimulantBumpFromMeal(m);
    caffeineMg += c;
    alcoholG += a;
  }
  return {
    caffeineMg: Math.round(caffeineMg),
    alcoholG: Math.round(alcoholG * 10) / 10,
  };
}

/**
 * Bump the daily caffeine + alcohol totals for a single logged meal.
 * Fire-and-forget at every call site; the meal row is the source of
 * truth so a failed bump leaves the per-meal micros intact.
 */
export async function bumpStimulantsForLoggedMeal(
  supabase: SupabaseLike,
  userId: string,
  dayKey: string,
  meal: StimulantBumpInput,
): Promise<UpdateStimulantsResult> {
  const { caffeineMg, alcoholG } = readStimulantBumpFromMeal(meal);
  if (caffeineMg <= 0 && alcoholG <= 0) {
    return { ok: true, caffeineMg: 0, alcoholG: 0 };
  }
  return updateStimulantsForDay(supabase, userId, dayKey, {
    caffeineMg,
    alcoholG,
  });
}

/**
 * Bulk variant — sums caffeine + alcohol across `meals` and fires a
 * single supabase write. Used by paths that insert N rows in one go
 * (duplicate-day, copy-meal-to-range, commitAiLoggedItems).
 */
export async function bumpStimulantsForLoggedMeals(
  supabase: SupabaseLike,
  userId: string,
  dayKey: string,
  meals: ReadonlyArray<StimulantBumpInput>,
): Promise<UpdateStimulantsResult> {
  const { caffeineMg, alcoholG } = readStimulantBumpFromMeals(meals);
  if (caffeineMg <= 0 && alcoholG <= 0) {
    return { ok: true, caffeineMg: 0, alcoholG: 0 };
  }
  return updateStimulantsForDay(supabase, userId, dayKey, {
    caffeineMg,
    alcoholG,
  });
}
