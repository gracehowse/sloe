/**
 * ENG-898 — recent URL imports list (web + mobile parity).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RecentImportSource = "tiktok" | "instagram" | "youtube" | "web";

export interface RecentImportItem {
  name: string;
  source: RecentImportSource;
  time: string;
}

export const RECENT_IMPORTS_LIMIT = 3;

type RecentImportRow = {
  title: string;
  source_name: string | null;
  created_at: string;
};

export function mapSourceNameToRecentImportSource(
  sourceName: string | null | undefined,
): RecentImportSource {
  const src = (sourceName ?? "").toLowerCase();
  if (src.includes("tiktok")) return "tiktok";
  if (src.includes("instagram")) return "instagram";
  if (src.includes("youtube")) return "youtube";
  return "web";
}

export function recentImportMonogram(source: RecentImportSource): string {
  switch (source) {
    case "tiktok":
      return "TT";
    case "instagram":
      return "IG";
    case "youtube":
      return "YT";
    default:
      return "W";
  }
}

export function formatRecentImportRelativeTime(createdAt: string, nowMs = Date.now()): string {
  const diffDays = Math.floor((nowMs - new Date(createdAt).getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

export function mapRecipeRowsToRecentImports(
  rows: RecentImportRow[],
  nowMs = Date.now(),
): RecentImportItem[] {
  return rows.map((row) => ({
    name: row.title,
    source: mapSourceNameToRecentImportSource(row.source_name),
    time: formatRecentImportRelativeTime(row.created_at, nowMs),
  }));
}

export async function fetchRecentImports(
  client: Pick<SupabaseClient, "from">,
  authorId: string,
): Promise<RecentImportItem[]> {
  const { data } = await client
    .from("recipes")
    .select("title, source_name, created_at")
    .eq("author_id", authorId)
    .not("source_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(RECENT_IMPORTS_LIMIT);

  if (!data?.length) return [];
  return mapRecipeRowsToRecentImports(data as RecentImportRow[]);
}
