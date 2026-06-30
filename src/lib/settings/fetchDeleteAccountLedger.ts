/**
 * Live counts for the DeleteAccount step-2 removal ledger (ENG-1260).
 *
 * Owner-column correctness (ENG-1270): each query MUST filter on the real
 * owner column for its table per `database.types.ts`. A wrong column makes the
 * query error, which previously fell into a single shared `catch` and blanked
 * the WHOLE ledger to null — gutting the informed-consent step on an
 * irreversible flow. Owner columns verified 2026-06-29:
 *   - nutrition_entries → `user_id`
 *   - recipes (created/authored) → `author_id` (NOT `user_id` — no such column);
 *     visibility column is `published: boolean`
 *   - saves (saved recipes) → `user_id`
 *   - profiles → `id`; weight history JSONB is `weight_kg_by_day` (NOT
 *     `weight_by_day` — no such column); household via `household_id`
 *   - household_members → `user_id`
 *
 * De-conflation (ENG-1263): the red-✕ "removed" recipes row must count ONLY
 * what is hard-deleted — saved recipes (`saves`) + UNPUBLISHED authored drafts
 * (`recipes WHERE author_id = user AND published = false`). Published authored
 * recipes survive de-attributed (`author_id = null`; delete route step 4) so
 * they must NOT appear as a removed row — they're disclosed by the footnote
 * (`DELETE_ACCOUNT_DEATTRIBUTION_NOTE`) instead. Bundling published recipes
 * into "removed" over-promised deletion (a trust gap for privacy-motivated
 * deleters). Path A: clarity, not a deletion-behaviour change.
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

  const [diaryEntries, draftRecipes, savedRecipes, profile, householdCount] =
    await Promise.all([
      safeCount("nutrition_entries", () =>
        supabase
          .from("nutrition_entries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ),
      // Only UNPUBLISHED authored drafts are hard-deleted (delete route step 3).
      // Published authored recipes survive de-attributed (step 4) → excluded
      // here, disclosed via DELETE_ACCOUNT_DEATTRIBUTION_NOTE. (ENG-1263)
      safeCount("recipes", () =>
        supabase
          .from("recipes")
          .select("id", { count: "exact", head: true })
          .eq("author_id", userId)
          .eq("published", false),
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

  // "Saved recipes & drafts" — the recipes that are HARD-DELETED: unpublished
  // authored drafts + saved recipes (both removed by the delete route). Each
  // side is independently resilient: if both queries fail (both null), keep the
  // row generic (null); if either succeeds, show the partial-but-truthful total
  // rather than blanking. Published authored recipes are NOT counted here — they
  // survive de-attributed and are covered by the disclosure footnote. (ENG-1263)
  const recipes =
    draftRecipes == null && savedRecipes == null
      ? null
      : (draftRecipes ?? 0) + (savedRecipes ?? 0);

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
