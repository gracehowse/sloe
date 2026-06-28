import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

export async function readCreatorFollowState(
  supabase: SupabaseClient<Database>,
  userId: string,
  creatorIds: readonly string[],
): Promise<Record<string, boolean>> {
  if (creatorIds.length === 0) return {};
  const { data, error } = await supabase
    .from("follows")
    .select("creator_id")
    .eq("user_id", userId)
    .in("creator_id", [...creatorIds]);

  if (error || !data) return {};

  return Object.fromEntries(data.map((row) => [row.creator_id, true]));
}

export async function toggleCreatorFollow(
  supabase: SupabaseClient<Database>,
  userId: string,
  creatorId: string,
  isFollowing: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isFollowing) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("creator_id", creatorId)
      .eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await supabase
    .from("follows")
    .upsert({ creator_id: creatorId, user_id: userId }, { onConflict: "creator_id,user_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
