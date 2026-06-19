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

type SupabaseLike = {
  from: (table: "profiles") => {
    update: (patch: Record<string, unknown>) => {
      eq: (
        column: "id",
        value: string,
      ) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

export async function persistWeightKgByDay(opts: {
  supabase: any;
  userId: string;
  weightKgByDay: Record<string, number>;
  weightKg: number | null;
}): Promise<void> {
  const nextMap = pruneWeightKgByDay(opts.weightKgByDay);
  const { error } = await opts.supabase
    .from("profiles")
    .update({ weight_kg: opts.weightKg, weight_kg_by_day: nextMap })
    .eq("id", opts.userId);
  if (error) throw new Error(error.message ?? "Could not save weight history.");
  await refreshAdaptiveTdeeForUser(opts.supabase, opts.userId);
}
