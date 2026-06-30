/**
 * Live counts for the DeleteAccount step-2 removal ledger (ENG-1260).
 *
 * Owner-column correctness (ENG-1270): each query MUST filter on the real
 * owner column for its table per `database.types.ts`. A wrong column makes the
 * query error, which previously fell into a single shared `catch` and blanked
 * the WHOLE ledger to null — gutting the informed-consent step on an
 * irreversible flow. Owner columns verified 2026-06-29:
 *   - nutrition_entries → `user_id`
 *   - recipes (created/authored) → `author_id` (NOT `user_id` — no such column)
 *   - saves (saved recipes) → `user_id`
 *   - profiles → `id`; weight history JSONB is `weight_kg_by_day` (NOT
 *     `weight_by_day` — no such column); household via `household_id`
 *   - household_members → `user_id`
 *
 * Resilience: each count is resolved independently. One failing query degrades
 * only its own row (to the generic "unknown count" label via a null count),
 * and the failure is logged loudly — it never zeroes or blanks the others.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  formatDeleteAccountLedgerRows,
  type DeleteAccountLedgerRow,
} from "./deleteAccountFlow";

type CountClient = Pick<SupabaseClient, "from">;

type CountResult = { count: number | null; error: unknown };

function logLedgerError(scope: string, error: unknown): void {
  if (!error) return;
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  console.error(`[deleteAccountLedger] ${scope} count failed:`, message);
}

/** Run a head/exact count query, returning a null count (never throwing) on error. */
async function safeCount(
  scope: string,
  run: () => PromiseLike<CountResult>,
): Promise<number | null> {
  try {
    const { count, error } = await run();
    if (error) {
      logLedgerError(scope, error);
      return null;
    }
    return count ?? 0;
  } catch (error) {
    logLedgerError(scope, error);
    return null;
  }
}

export async function fetchDeleteAccountLedger(
  supabase: CountClient,
  userId: string,
): Promise<DeleteAccountLedgerRow[]> {
  if (!userId) {
    return formatDeleteAccountLedgerRows({
      diaryEntries: null,
      recipes: null,
      weightDays: null,
      inHousehold: null,
    });
  }

  const [diaryEntries, createdRecipes, savedRecipes, profile, householdCount] =
    await Promise.all([
      safeCount("nutrition_entries", () =>
        supabase
          .from("nutrition_entries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ),
      safeCount("recipes", () =>
        supabase
          .from("recipes")
          .select("id", { count: "exact", head: true })
          .eq("author_id", userId),
      ),
      safeCount("saves", () =>
        supabase
          .from("saves")
          .select("recipe_id", { count: "exact", head: true })
          .eq("user_id", userId),
      ),
      fetchProfileLedgerFields(supabase, userId),
      safeCount("household_members", () =>
        supabase
          .from("household_members")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ),
    ]);

  // "Saved & created recipes" — sum authored recipes and saved recipes. Both
  // are removed by the delete route (private recipes deleted, published
  // unattributed; saves rows deleted). Each side is independently resilient:
  // if both queries fail (both null), keep the row generic (null); if either
  // succeeds, show the partial-but-truthful total rather than blanking.
  const recipes =
    createdRecipes == null && savedRecipes == null
      ? null
      : (createdRecipes ?? 0) + (savedRecipes ?? 0);

  return formatDeleteAccountLedgerRows({
    diaryEntries,
    recipes,
    weightDays: profile.weightDays,
    inHousehold: deriveInHousehold(householdCount, profile.householdId),
  });
}

async function fetchProfileLedgerFields(
  supabase: CountClient,
  userId: string,
): Promise<{ weightDays: number | null; householdId: string | null }> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("weight_kg_by_day, household_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      logLedgerError("profiles", error);
      return { weightDays: null, householdId: null };
    }
    const row = (data ?? null) as {
      weight_kg_by_day?: unknown;
      household_id?: string | null;
    } | null;
    const weightByDay = row?.weight_kg_by_day;
    const weightDays =
      weightByDay && typeof weightByDay === "object" && !Array.isArray(weightByDay)
        ? Object.keys(weightByDay as Record<string, unknown>).length
        : 0;
    return { weightDays, householdId: row?.household_id ?? null };
  } catch (error) {
    logLedgerError("profiles", error);
    return { weightDays: null, householdId: null };
  }
}

/**
 * In a household if a membership row exists OR the profile carries a
 * `household_id`. When BOTH signals are unavailable (both null) we can't
 * assert "not in a household", so return null to keep the row generic rather
 * than falsely claiming the user has no household to leave.
 */
function deriveInHousehold(
  householdCount: number | null,
  householdId: string | null,
): boolean | null {
  if (householdCount == null && householdId == null) return null;
  return (householdCount ?? 0) > 0 || Boolean(householdId);
}
