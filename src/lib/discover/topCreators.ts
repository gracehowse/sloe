import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A creator chip for the Discover "top creators by saves" rail (ENG-1225 #14).
 * Lives in the shared lib (not the web component) so the mobile rail
 * (`apps/mobile/components/discover/CreatorRail.tsx`) can reuse the loader +
 * type without pulling web React into Metro.
 */
export interface CreatorChip {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  /** Optional specialty line for Following feed cards. */
  bio?: string | null;
}

type TopCreatorRow = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  saves: number;
};

/**
 * ENG-1535 — fixed IDs inserted by the retired "launch partners" migration.
 * They were invented personas, not creators who consented to a public profile.
 * Keep the trust guard in the shared loader until every environment has run the
 * cleanup migration; real creators with different IDs remain eligible.
 */
const SYNTHETIC_DISCOVER_CREATOR_IDS = new Set([
  "a1000001-0001-4000-8000-000000000001",
  "a1000001-0001-4000-8000-000000000002",
  "a1000001-0001-4000-8000-000000000003",
  "a1000001-0001-4000-8000-000000000004",
  "a1000001-0001-4000-8000-000000000005",
]);

export function isSyntheticDiscoverCreatorId(id: string): boolean {
  return SYNTHETIC_DISCOVER_CREATOR_IDS.has(id);
}

/**
 * loadTopCreators — the Discover creator rail's data source (ENG-1225 #14):
 * creators ranked by total recipe saves, via the `top_creators_by_saves` RPC.
 * Returns `[]` on any error or when no creators exist (the rail then hides) —
 * never throws into the Discover render.
 */
export async function loadTopCreators(
  supabase: Pick<SupabaseClient, "rpc">,
  limit = 12,
): Promise<CreatorChip[]> {
  try {
    const { data, error } = await supabase.rpc("top_creators_by_saves", {
      p_limit: limit,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as TopCreatorRow[])
      .filter(
        (r) =>
          r.id &&
          !isSyntheticDiscoverCreatorId(r.id) &&
          (r.display_name ?? "").trim().length > 0,
      )
      .map((r) => ({
        id: r.id,
        handle: r.handle ?? r.id,
        displayName: (r.display_name ?? "").trim(),
        avatarUrl: r.avatar_url,
        bio: r.bio ?? null,
      }));
  } catch {
    return [];
  }
}
