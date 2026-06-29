/**
 * Live counts for the DeleteAccount step-2 removal ledger (ENG-1260).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  formatDeleteAccountLedgerRows,
  type DeleteAccountLedgerRow,
} from "./deleteAccountFlow";

type CountClient = Pick<SupabaseClient, "from">;

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

  try {
    const [entriesRes, recipesRes, profileRes, householdRes] = await Promise.all([
      supabase
        .from("nutrition_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("recipes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("profiles")
        .select("weight_by_day, household_id")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("household_members")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    const weightByDay = profileRes.data?.weight_by_day;
    const weightDays =
      weightByDay && typeof weightByDay === "object" && !Array.isArray(weightByDay)
        ? Object.keys(weightByDay as Record<string, unknown>).length
        : 0;

    const inHousehold =
      (householdRes.count ?? 0) > 0 || Boolean(profileRes.data?.household_id);

    return formatDeleteAccountLedgerRows({
      diaryEntries: entriesRes.count ?? 0,
      recipes: recipesRes.count ?? 0,
      weightDays,
      inHousehold,
    });
  } catch {
    return formatDeleteAccountLedgerRows({
      diaryEntries: null,
      recipes: null,
      weightDays: null,
      inHousehold: null,
    });
  }
}
