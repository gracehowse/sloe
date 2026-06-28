import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

export type CommunityShareConsent = {
  consented: boolean;
  consentedAt: string | null;
};

export async function readCommunityShareConsent(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CommunityShareConsent> {
  const { data, error } = await supabase
    .from("profiles")
    .select("community_food_share_consent, community_food_share_consent_at" as "id")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return { consented: false, consentedAt: null };
  }

  const row = data as {
    community_food_share_consent?: boolean | null;
    community_food_share_consent_at?: string | null;
  };

  return {
    consented: row.community_food_share_consent === true,
    consentedAt: row.community_food_share_consent_at ?? null,
  };
}

export async function setCommunityShareConsent(
  supabase: SupabaseClient<Database>,
  userId: string,
  consented: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("profiles")
    .update({
      community_food_share_consent: consented,
      community_food_share_consent_at: consented ? new Date().toISOString() : null,
    } as never)
    .eq("id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
