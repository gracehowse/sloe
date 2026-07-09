import * as React from "react";

import { supabase } from "@/lib/supabase";
import { refreshAdaptiveTdeeForUser } from "@/lib/refreshAdaptiveTdee";

export const MAX_WEIGHT_JSONB_DAYS = 400;

export type WeightMutationResult = {
  weightKgByDay: Record<string, number>;
  weightKg: number | null;
};

export function parseWeightKgByDay(raw: unknown): Record<string, number> {
  let o: Record<string, unknown> | null = null;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p))
        o = p as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    o = raw as Record<string, unknown>;
  }
  if (!o) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

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

function latestWeightFromMap(map: Record<string, number>): number | null {
  const newest = newestWeightDateKey(map);
  return newest ? map[newest] : null;
}

export function useWeightData(userId: string | null | undefined) {
  const [weightKgByDay, setWeightKgByDay] = React.useState<
    Record<string, number>
  >({});
  const [weightKg, setWeightKg] = React.useState<number | null>(null);
  const [goalWeightKg, setGoalWeightKg] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);

  const hydrateFromProfile = React.useCallback(
    (
      profile:
        | {
            weight_kg?: unknown;
            goal_weight_kg?: unknown;
            weight_kg_by_day?: unknown;
          }
        | null
        | undefined,
    ) => {
      if (!profile) return;
      // ENG-1373 — partial-row hydration guard. Some call sites (e.g.
      // progress.tsx's post-HealthKit-sync re-read) SELECT only a subset
      // of columns for a narrow purpose (steps/weight refresh) and pass
      // that partial row straight to this same hydrate function. Any key
      // that's genuinely ABSENT from the row (`in` check, not just
      // nullish) must leave the corresponding state untouched — a fuller
      // fetch may already have set it correctly, and a partial re-read
      // must never clobber that back to null. A key that IS present but
      // explicitly null (e.g. the user cleared their goal weight) still
      // correctly resets state to null.
      if ("weight_kg_by_day" in profile) {
        const map = parseWeightKgByDay(profile.weight_kg_by_day);
        setWeightKgByDay(map);
        const weight =
          profile.weight_kg != null
            ? Number(profile.weight_kg)
            : latestWeightFromMap(map);
        setWeightKg(Number.isFinite(weight) ? weight : null);
      } else if ("weight_kg" in profile) {
        const weight = profile.weight_kg != null ? Number(profile.weight_kg) : null;
        setWeightKg(Number.isFinite(weight) ? weight : null);
      }
      if ("goal_weight_kg" in profile) {
        const goal =
          profile.goal_weight_kg != null ? Number(profile.goal_weight_kg) : null;
        setGoalWeightKg(Number.isFinite(goal) ? goal : null);
      }
    },
    [],
  );

  const reload = React.useCallback(async () => {
    if (!userId) {
      setWeightKgByDay({});
      setWeightKg(null);
      setGoalWeightKg(null);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("weight_kg, goal_weight_kg, weight_kg_by_day")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      hydrateFromProfile(data);
    } finally {
      setLoading(false);
    }
  }, [hydrateFromProfile, userId]);

  // ENG-1373 — NO mount-triggered auto-fetch here. This hook used to fire
  // its own independent `profiles` SELECT on every mount, racing the
  // host screen's own hydrate flow (`progress.tsx`'s `loadData` already
  // fetches `profiles` — including `weight_kg`/`goal_weight_kg`/
  // `weight_kg_by_day` — and calls `hydrateFromProfile` itself). Two
  // unordered network requests writing the same `weightKgByDay` /
  // `goalWeightKg` state meant whichever resolved last won, so a user
  // could transiently (or, on a slow/dropped race, semi-permanently)
  // see GOAL/RATE em-dashes from one fetch's null `goal_weight_kg` while
  // another card on the same paint had already picked up the other
  // fetch's non-null value. `hydrateFromProfile` is still exported and
  // callable directly (see `reload`, kept for explicit pull-to-refresh /
  // post-mutation re-sync call sites) — this hook just no longer decides
  // on its own that mounting means "go fetch". The host is the single
  // source of truth for when + how weight data gets (re)loaded.

  /**
   * ENG-1306 — persist a per-day PATCH through the `upsert_body_metric_days`
   * RPC instead of a client-side read-modify-write of the whole map. The
   * server merges under the row lock, so a HealthKit sync racing a manual
   * weigh-in (or another device) can no longer clobber this write's days —
   * and vice versa. Patch value `null` deletes that day; the scalar
   * `weight_kg` is derived server-side from the merged map. Local state is
   * rehydrated from the server-merged result (true post-merge picture).
   */
  const persistWeightPatch = React.useCallback(
    async (
      patch: Record<string, number | null>,
    ): Promise<WeightMutationResult> => {
      if (!userId) throw new Error("Sign in before changing weight history.");
      const { data, error } = await supabase.rpc("upsert_body_metric_days", {
        p_weight_patch: patch,
      });
      if (error) throw error;
      await refreshAdaptiveTdeeForUser(supabase, userId);
      const merged = (data ?? {}) as {
        weight_kg_by_day?: unknown;
        weight_kg?: unknown;
      };
      const mergedMap = parseWeightKgByDay(merged.weight_kg_by_day);
      const mergedWeight =
        typeof merged.weight_kg === "number" && Number.isFinite(merged.weight_kg)
          ? merged.weight_kg
          : null;
      setWeightKgByDay(mergedMap);
      setWeightKg(mergedWeight);
      return { weightKgByDay: mergedMap, weightKg: mergedWeight };
    },
    [userId],
  );

  const logWeight = React.useCallback(
    async (kg: number, dateKey: string): Promise<WeightMutationResult> => {
      const previousMap = weightKgByDay;
      const previousWeight = weightKg;
      const nextMap = pruneWeightKgByDay({ ...weightKgByDay, [dateKey]: kg });
      const newest = newestWeightDateKey(nextMap);
      const nextWeight = newest === dateKey ? kg : latestWeightFromMap(nextMap);
      setWeightKgByDay(nextMap);
      setWeightKg(nextWeight);
      try {
        return await persistWeightPatch({ [dateKey]: kg });
      } catch (error) {
        setWeightKgByDay(previousMap);
        setWeightKg(previousWeight);
        throw error;
      }
    },
    [persistWeightPatch, weightKg, weightKgByDay],
  );

  const editWeight = logWeight;

  const deleteWeight = React.useCallback(
    async (dateKey: string): Promise<WeightMutationResult> => {
      const previousMap = weightKgByDay;
      const previousWeight = weightKg;
      const nextMap = { ...weightKgByDay };
      delete nextMap[dateKey];
      const nextWeight = latestWeightFromMap(nextMap);
      setWeightKgByDay(nextMap);
      setWeightKg(nextWeight);
      try {
        return await persistWeightPatch({ [dateKey]: null });
      } catch (error) {
        setWeightKgByDay(previousMap);
        setWeightKg(previousWeight);
        throw error;
      }
    },
    [persistWeightPatch, weightKg, weightKgByDay],
  );

  return {
    weightKgByDay,
    weightKg,
    goalWeightKg,
    latestWeightKg: latestWeightFromMap(weightKgByDay) ?? weightKg,
    loading,
    hydrateFromProfile,
    reload,
    logWeight,
    editWeight,
    deleteWeight,
    setWeightKgByDay,
    setWeightKg,
    setGoalWeightKg,
  };
}
