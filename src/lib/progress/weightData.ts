import { refreshAdaptiveTdeeForUser } from "../nutrition/refreshAdaptiveTdee.ts";

export const MAX_WEIGHT_JSONB_DAYS = 400;

export function pruneWeightKgByDay(
  map: Record<string, number>,
): Record<string, number> {
  const keys = Object.keys(map)
    .sort()
    .reverse()
    .slice(0, MAX_WEIGHT_JSONB_DAYS);
  const pruned: Record<string, number> = {};
  for (const key of keys) pruned[key] = map[key];
  return pruned;
}

export function newestWeightDateKey(
  map: Record<string, number>,
): string | null {
  return (
    Object.entries(map)
      .filter(([, kg]) => Number.isFinite(kg) && kg > 0)
      .map(([key]) => key)
      .sort()
      .reverse()[0] ?? null
  );
}

export function latestWeightFromMap(
  map: Record<string, number>,
): number | null {
  const newest = newestWeightDateKey(map);
  return newest ? map[newest] : null;
}

/**
 * ENG-1306 — persist weigh-in changes as a per-day PATCH through the
 * `upsert_body_metric_days` RPC instead of a client-side read-modify-write
 * of the whole `weight_kg_by_day` map. Server-side jsonb key upserts under
 * the row lock mean a HealthKit sync racing a manual weigh-in (or two
 * devices) merge instead of clobbering each other's days. Patch value
 * `null` deletes that day. The scalar `weight_kg` is derived server-side
 * from the merged map (newest positive day), so it is no longer passed in.
 *
 * Returns the server-merged map so callers can rehydrate local state with
 * the true post-merge picture.
 */
export async function persistWeightDayPatch(opts: {
  supabase: any;
  userId: string;
  patch: Record<string, number | null>;
}): Promise<{ weightKgByDay: Record<string, number>; weightKg: number | null }> {
  const { data, error } = await opts.supabase.rpc("upsert_body_metric_days", {
    p_weight_patch: opts.patch,
  });
  if (error) throw new Error(error.message ?? "Could not save weight history.");
  const merged = (data as {
    weight_kg_by_day?: Record<string, number>;
    weight_kg?: number | null;
  } | null) ?? {};
  await refreshAdaptiveTdeeForUser(opts.supabase, opts.userId);
  return {
    weightKgByDay: merged.weight_kg_by_day ?? {},
    weightKg: typeof merged.weight_kg === "number" ? merged.weight_kg : null,
  };
}
