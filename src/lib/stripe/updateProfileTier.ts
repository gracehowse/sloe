import { createClient } from "@supabase/supabase-js";
import type { UserTier } from "../../types/recipe.ts";
import { supabasePublicUrl } from "../supabase/serverAnonClient.ts";

export async function updateProfileTierServiceRole(userId: string, tier: UserTier): Promise<boolean> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return false;
  const sb = createClient(supabasePublicUrl(), key, { auth: { persistSession: false } });
  const { error } = await sb.from("profiles").update({ user_tier: tier }).eq("id", userId);
  return !error;
}
