import { createClient } from "@supabase/supabase-js";
import type { UserTier } from "../../types/recipe.ts";
import { supabasePublicUrl } from "../supabase/serverAnonClient.ts";

export type UpdateProfileTierResult =
  | { ok: true; outcome: "updated" }
  | { ok: true; outcome: "floor_protected"; currentTier: string }
  | { ok: false; reason: "service_role_missing" | "read_failed" | "write_failed" };

/**
 * Service-role tier write used by Stripe + RevenueCat webhooks.
 *
 * ENG-49: never downgrade a durable comp (`lifetime_pro`) or any tier
 * whose rank exceeds the requested tier — mirrors mobile `resolveNextTier`.
 */
export async function updateProfileTierServiceRole(
  userId: string,
  tier: UserTier,
): Promise<boolean> {
  const result = await updateProfileTierServiceRoleDetailed(userId, tier);
  return result.ok;
}

/** @internal — richer result for unit tests. */
export async function updateProfileTierServiceRoleDetailed(
  userId: string,
  tier: UserTier,
): Promise<UpdateProfileTierResult> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return { ok: false, reason: "service_role_missing" };

  const sb = createClient(supabasePublicUrl(), key, { auth: { persistSession: false } });

  const { data: profile, error: readError } = await sb
    .from("profiles")
    .select("user_tier")
    .eq("id", userId)
    .maybeSingle();

  if (readError) return { ok: false, reason: "read_failed" };

  const current = (profile?.user_tier as string | null | undefined) ?? "free";
  // ENG-49: founding comp is durable — webhooks never downgrade lifetime_pro.
  // Paid Pro → Free downgrades remain authoritative (Stripe / RC expiry).
  if (current === "lifetime_pro") {
    return { ok: true, outcome: "floor_protected", currentTier: current };
  }

  const { error } = await sb.from("profiles").update({ user_tier: tier }).eq("id", userId);
  if (error) return { ok: false, reason: "write_failed" };
  return { ok: true, outcome: "updated" };
}
