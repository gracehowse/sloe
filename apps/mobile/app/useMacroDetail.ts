import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";
import {
  deriveIngredientBreakdown,
  toBreakdownEntry,
  toBreakdownIngredientRow,
  toBreakdownSnapshotRow,
  type BreakdownEntry,
  type BreakdownIngredientRow,
  type BreakdownMacro,
  type BreakdownSnapshotRow,
  type IngredientBreakdownResult,
} from "@suppr/nutrition-core/macroIngredientBreakdown";
import {
  isSnapshotRowLowConfidence,
  NUTRITION_ENTRY_INGREDIENTS_FLAG,
  NUTRITION_ENTRY_INGREDIENTS_TABLE,
  type NutritionEntryIngredientRow,
} from "@suppr/shared/nutrition/nutritionEntryIngredients";
import { isFeatureEnabled } from "@/lib/analytics";
import { mealContributedFiberG } from "@/lib/healthDietaryNutrients";
import { parseNutritionMicrosJson } from "@/lib/nutritionJournal";

/**
 * Composition-root hook for `app/macro-detail.tsx` (ENG-621 pattern). Owns the
 * data fetch (entries + a single batched `recipe_ingredients` query), slot
 * grouping for the "By meal" view, and the derived "By ingredient" breakdown
 * via the shared web+mobile helper. The screen file stays a thin shell.
 */

export type Meal = {
  /** Stable id of the logged entry. */
  id: string;
  name: string;
  recipeTitle: string;
  recipeId: string | null;
  portionMultiplier: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  waterMl: number;
};

// The breakdown helper supports the four macros + calories. `water` is a
// macro-detail-only column with no per-ingredient decomposition, so the
// ingredient toggle is hidden for it (handled in render).
const BREAKDOWN_MACROS = new Set<string>(["protein", "carbs", "fat", "fiber", "calories"]);

export interface UseMacroDetailArgs {
  userId: string | undefined;
  dateKey: string;
  macro: string;
  /** The `Meal` field for the active macro, used for the by-meal totals. */
  field: keyof Meal;
}

export interface UseMacroDetailResult {
  meals: Meal[];
  loading: boolean;
  total: number;
  mealsBySlot: Record<string, Meal[]>;
  slotOrder: string[];
  supportsIngredientBreakdown: boolean;
  ingredientBreakdown: IngredientBreakdownResult;
}

export function useMacroDetail({
  userId,
  dateKey,
  macro,
  field,
}: UseMacroDetailArgs): UseMacroDetailResult {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [ingredientRows, setIngredientRows] = useState<BreakdownIngredientRow[]>([]);
  // ENG-751 — persisted AI/photo/voice per-item snapshot rows for the day's
  // entries. Only fetched + applied when the display flag is on; flag-OFF keeps
  // today's single-line fallback (the data can backfill while the gate is dark).
  const [snapshotRows, setSnapshotRows] = useState<BreakdownSnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    // Audit 2026-05-04 #16: previous code had no error/timeout handling
    // — when the request rejected (network wedge, RLS, hung PostgREST),
    // `setLoading(false)` never ran and the screen stayed on "Loading…"
    // forever. Same network-resilience pattern as the c9ebfac perpetual-
    // spinner fix: race the fetch against an 8s deadline so the gate
    // always opens, then either render the list (success) or the empty
    // state (timeout / failure).
    const TIMEOUT_MS = 8_000;
    const finish = () => {
      if (!cancelled) setLoading(false);
    };
    const timer = setTimeout(finish, TIMEOUT_MS);

    // ENG-751 — fetch persisted AI snapshot rows for the day's entries. Gated by
    // the display flag so a flag-OFF read never splits. Fully defensive: if the
    // table doesn't exist yet (pre-push) or the query fails, swallow + leave
    // `snapshotRows` empty so the read degrades to the recipe / fallback path.
    const fetchSnapshots = async (entryIds: string[]): Promise<void> => {
      if (!isFeatureEnabled(NUTRITION_ENTRY_INGREDIENTS_FLAG) || entryIds.length === 0) {
        if (!cancelled) setSnapshotRows([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from(NUTRITION_ENTRY_INGREDIENTS_TABLE)
          .select("entry_id, name, calories, protein, carbs, fat, fiber_g, confidence")
          .in("entry_id", entryIds);
        if (cancelled) return;
        if (error) throw error;
        setSnapshotRows(
          ((data ?? []) as NutritionEntryIngredientRow[]).map((r) =>
            toBreakdownSnapshotRow({
              entryId: r.entry_id,
              name: r.name,
              lowConfidence: isSnapshotRowLowConfidence(r),
              calories: r.calories,
              protein: r.protein,
              carbs: r.carbs,
              fat: r.fat,
              fiberG: r.fiber_g,
            }),
          ),
        );
      } catch (err) {
        if (cancelled) return;
        if (typeof console !== "undefined") {
          console.warn(
            "[macro-detail] nutrition_entry_ingredients fetch failed:",
            err instanceof Error ? err.message : err,
          );
        }
        setSnapshotRows([]);
      }
    };

    supabase
      .from("nutrition_entries")
      .select(
        "id, name, recipe_title, recipe_id, portion_multiplier, source, calories, protein, carbs, fat, fiber_g, water_ml, nutrition_micros",
      )
      .eq("user_id", userId)
      .eq("date_key", dateKey)
      .order("created_at", { ascending: true })
      .then(
        async ({ data: rows }) => {
          if (cancelled) return;
          const mapped: Meal[] = (rows ?? []).map((r: Record<string, unknown>) => ({
            id: (r.id as string) ?? "",
            name: (r.name as string) ?? "",
            recipeTitle: (r.recipe_title as string) ?? "",
            recipeId: (r.recipe_id as string | null) ?? null,
            portionMultiplier: r.portion_multiplier != null ? Number(r.portion_multiplier) : 1,
            calories: Number(r.calories) || 0,
            protein: Number(r.protein) || 0,
            carbs: Number(r.carbs) || 0,
            fat: Number(r.fat) || 0,
            fiberG: mealContributedFiberG({
              fiberG: r.fiber_g != null ? Number(r.fiber_g) : undefined,
              micros: parseNutritionMicrosJson(r.nutrition_micros),
            }),
            waterMl: r.water_ml != null ? Number(r.water_ml) : 0,
          }));
          setMeals(mapped);

          // ENG-751 — snapshot fetch covers EVERY entry id (AI meals have no
          // recipe_id, so the recipe-id set below would miss them). Runs in
          // parallel with the recipe-ingredients fetch.
          const entryIds = mapped.map((m) => m.id).filter((x) => !!x);
          const snapshotPromise = fetchSnapshots(entryIds);

          // Batched per-ingredient fetch (one query, no N+1) for the "By
          // ingredient" view. Collect the day's distinct non-null recipe_ids;
          // recipe_ingredients is public-readable. If there are none (single
          // foods / AI meals only), skip the query and finish immediately.
          const recipeIds = Array.from(
            new Set(mapped.map((m) => m.recipeId).filter((x): x is string => !!x)),
          );
          if (recipeIds.length === 0) {
            await snapshotPromise;
            if (cancelled) return;
            clearTimeout(timer);
            setIngredientRows([]);
            finish();
            return;
          }
          supabase
            .from("recipe_ingredients")
            .select("recipe_id, name, calories, protein, carbs, fat, fiber_g")
            .in("recipe_id", recipeIds)
            .then(
              async ({ data: ingRows }) => {
                if (cancelled) return;
                setIngredientRows(
                  (ingRows ?? []).map((r: Record<string, unknown>) =>
                    toBreakdownIngredientRow({
                      recipeId: r.recipe_id as string,
                      name: r.name as string,
                      calories: r.calories != null ? Number(r.calories) : 0,
                      protein: r.protein != null ? Number(r.protein) : 0,
                      carbs: r.carbs != null ? Number(r.carbs) : 0,
                      fat: r.fat != null ? Number(r.fat) : 0,
                      fiberG: r.fiber_g != null ? Number(r.fiber_g) : 0,
                    }),
                  ),
                );
                await snapshotPromise;
                if (cancelled) return;
                clearTimeout(timer);
                finish();
              },
              async (err: unknown) => {
                if (cancelled) return;
                if (typeof console !== "undefined") {
                  console.warn(
                    "[macro-detail] recipe_ingredients fetch failed:",
                    err instanceof Error ? err.message : err,
                  );
                }
                // Degrade gracefully: with no ingredient rows the "By
                // ingredient" view falls back to one self-named line per entry
                // (or the snapshot split, if snapshot rows loaded).
                setIngredientRows([]);
                await snapshotPromise;
                if (cancelled) return;
                clearTimeout(timer);
                finish();
              },
            );
        },
        (err: unknown) => {
          if (cancelled) return;
          clearTimeout(timer);
          if (typeof console !== "undefined") {
            console.warn(
              "[macro-detail] nutrition_entries fetch failed:",
              err instanceof Error ? err.message : err,
            );
          }
          finish();
        },
      );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId, dateKey]);

  const total = useMemo(
    () => meals.reduce((sum, m) => sum + (Number(m[field]) || 0), 0),
    [meals, field],
  );

  // A meal slot is the `name` field on nutrition_entries (Breakfast / Lunch /
  // Dinner / Snack). Group meals by that bucket so "By meal" shows aggregated
  // slot totals + a sub-row per meal.
  const mealsBySlot = useMemo(() => {
    const buckets: Record<string, Meal[]> = {};
    for (const m of meals) {
      const slot = m.name || "Other";
      if (!buckets[slot]) buckets[slot] = [];
      buckets[slot].push(m);
    }
    return buckets;
  }, [meals]);

  const slotOrder = useMemo(() => {
    // Canonical meal-slot order so Breakfast renders first even if logged out
    // of sequence. Anything off-canonical keeps insertion order at the tail.
    const canonical = ["Breakfast", "Lunch", "Dinner", "Snack"];
    const present = Object.keys(mealsBySlot);
    const ordered: string[] = [];
    for (const k of canonical) {
      if (present.includes(k)) ordered.push(k);
    }
    for (const k of present) {
      if (!canonical.includes(k)) ordered.push(k);
    }
    return ordered;
  }, [mealsBySlot]);

  // "By ingredient" toggle only applies to the four macros + calories — water
  // has no per-ingredient decomposition.
  const supportsIngredientBreakdown = BREAKDOWN_MACROS.has(macro);

  // Derive the per-ingredient breakdown via the SHARED web+mobile helper so the
  // scale/reconcile logic lives in one place. Reconciles each entry's scaled
  // ingredient rows to its stored macro total; entries with no recipe rows fall
  // back to a single self-named line.
  const ingredientBreakdown = useMemo<IngredientBreakdownResult>(() => {
    if (!supportsIngredientBreakdown) return { lines: [], total: 0 };
    const entries: BreakdownEntry[] = meals.map((m) =>
      toBreakdownEntry({
        id: m.id,
        name: m.name,
        recipeTitle: m.recipeTitle,
        recipeId: m.recipeId,
        portionMultiplier: m.portionMultiplier,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        fiberG: m.fiberG,
      }),
    );
    // ENG-751 — prefer persisted AI snapshot rows over the single-line fallback
    // when present + the display flag is on. `snapshotRows` is only populated
    // when the flag was on at fetch time, but we re-check the flag here so the
    // gate is unambiguous at the derive boundary too.
    return deriveIngredientBreakdown(entries, ingredientRows, macro as BreakdownMacro, {
      snapshots: snapshotRows,
      preferSnapshot: isFeatureEnabled(NUTRITION_ENTRY_INGREDIENTS_FLAG),
    });
  }, [meals, ingredientRows, snapshotRows, macro, supportsIngredientBreakdown]);

  return {
    meals,
    loading,
    total,
    mealsBySlot,
    slotOrder,
    supportsIngredientBreakdown,
    ingredientBreakdown,
  };
}
