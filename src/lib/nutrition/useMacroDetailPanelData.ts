"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase/browserClient.ts";
import { isFeatureEnabled } from "../analytics/track.ts";
import { mealContributedFiberG } from "./microNutrientDisplay.ts";
import {
  toBreakdownIngredientRow,
  toBreakdownSnapshotRow,
  type BreakdownIngredientRow,
  type BreakdownSnapshotRow,
} from "./macroIngredientBreakdown.ts";
import {
  isSnapshotRowLowConfidence,
  NUTRITION_ENTRY_INGREDIENTS_FLAG,
  NUTRITION_ENTRY_INGREDIENTS_TABLE,
  type NutritionEntryIngredientRow,
} from "./nutritionEntryIngredients.ts";
import type { LoggedMeal } from "../../types/recipe.ts";
import type { MacroKey, MacroMeal } from "../../app/components/MacroDetailPanel";

/**
 * ENG-1360 (second extraction pass) — the macro-detail panel data cluster:
 * the `web_macro_detail_panel` flag check, the open/close target state, the
 * `mealsForSelectedDate` → `MacroMeal[]` projection, and the two Supabase
 * fetch effects (recipe-ingredient rows for recipe-sourced meals, persisted
 * AI-snapshot rows for AI-sourced meals) that hydrate the panel's ingredient
 * breakdown. Byte-for-byte lift of the original state/memo/effects that used
 * to live inline in NutritionTracker — same queries, same parsing, same
 * dependency arrays — just relocated so the host's local state list and JSX
 * both shrink. No behavior change.
 */
export function useMacroDetailPanelData(
  mealsForSelectedDate: LoggedMeal[],
  isMacroDetailSupported: (macro: string) => boolean,
) {
  const macroDetailFlagEnabled = isFeatureEnabled("web_macro_detail_panel");
  const [macroDetailTarget, setMacroDetailTarget] = useState<MacroKey | null>(null);
  const [macroDetailIngredientRows, setMacroDetailIngredientRows] = useState<
    BreakdownIngredientRow[]
  >([]);
  // ENG-751 — persisted AI/photo/voice per-item snapshot rows for the open
  // day's entries. Gated by the display flag; flag-OFF leaves this empty so the
  // panel keeps today's single-line fallback (data backfills while dark).
  const [macroDetailSnapshotRows, setMacroDetailSnapshotRows] = useState<
    BreakdownSnapshotRow[]
  >([]);

  const openMacroDetail = useCallback(
    (macro: string) => {
      if (!macroDetailFlagEnabled) return;
      // Shared affordance/handler source of truth (ENG-848): the same
      // `isMacroDetailSupported` set gates which tiles/bars render as buttons, so
      // a tappable tile can never resolve to a macro this handler ignores.
      if (isMacroDetailSupported(macro)) {
        setMacroDetailTarget(macro as MacroKey);
      }
    },
    [macroDetailFlagEnabled, isMacroDetailSupported],
  );

  // ENG-1247 — `.md-totalgrid` cell tap: close the dialog, open macro-detail.
  // Undefined when the panel is off → cells render static (no dead tap, ENG-848).
  const macroTapFromDialog = useCallback(
    (closeDialog: () => void) =>
      macroDetailFlagEnabled
        ? (macro: string) => {
            closeDialog();
            openMacroDetail(macro);
          }
        : undefined,
    [macroDetailFlagEnabled, openMacroDetail],
  );

  const macroDetailMeals = useMemo<MacroMeal[]>(
    () =>
      mealsForSelectedDate.map((meal) => ({
        id: meal.id,
        name: meal.name,
        recipeTitle: meal.recipeTitle,
        recipeId: meal.recipeId ?? null,
        portionMultiplier: meal.portionMultiplier ?? 1,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        fiberG: mealContributedFiberG(meal),
        // ENG-1213 web↔mobile water-breakdown parity: carry per-meal water so
        // the macro-detail panel's By-meal view can total water for macro="water"
        // (mirrors mobile useMacroDetail's `water_ml` → waterMl mapping). The
        // source value already flows DB → LoggedMeal via useNutritionJournalState
        // (`water_ml` → `waterMl`).
        waterMl: meal.waterMl ?? 0,
        micros: meal.micros ?? null,
      })),
    [mealsForSelectedDate],
  );

  useEffect(() => {
    if (!macroDetailFlagEnabled || macroDetailTarget == null) {
      setMacroDetailIngredientRows([]);
      return;
    }
    const recipeIds = Array.from(
      new Set(macroDetailMeals.map((meal) => meal.recipeId).filter((id): id is string => Boolean(id))),
    );
    if (recipeIds.length === 0) {
      setMacroDetailIngredientRows([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("recipe_ingredients")
      .select("recipe_id, name, calories, protein, carbs, fat, fiber_g")
      .in("recipe_id", recipeIds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[macro-detail] recipe_ingredients fetch failed:", error.message);
          setMacroDetailIngredientRows([]);
          return;
        }
        setMacroDetailIngredientRows(
          (data ?? []).map((row: Record<string, unknown>) =>
            toBreakdownIngredientRow({
              recipeId: String(row.recipe_id ?? ""),
              name: String(row.name ?? "Item"),
              calories: Number(row.calories) || 0,
              protein: Number(row.protein) || 0,
              carbs: Number(row.carbs) || 0,
              fat: Number(row.fat) || 0,
              fiberG: Number(row.fiber_g) || 0,
            }),
          ),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [macroDetailFlagEnabled, macroDetailMeals, macroDetailTarget]);

  // ENG-751 — fetch persisted AI snapshot rows for the open day's entries,
  // gated by the display flag. Fully defensive: a missing table (pre-push) or a
  // failed query swallows + leaves the rows empty, so the panel degrades to the
  // recipe / single-line fallback path. Covers EVERY entry id (AI meals have no
  // recipe_id, so the recipe-id set above would miss them).
  useEffect(() => {
    if (
      !macroDetailFlagEnabled ||
      macroDetailTarget == null ||
      !isFeatureEnabled(NUTRITION_ENTRY_INGREDIENTS_FLAG)
    ) {
      setMacroDetailSnapshotRows([]);
      return;
    }
    const entryIds = Array.from(
      new Set(macroDetailMeals.map((meal) => meal.id).filter((id): id is string => Boolean(id))),
    );
    if (entryIds.length === 0) {
      setMacroDetailSnapshotRows([]);
      return;
    }
    let cancelled = false;
    supabase
      .from(NUTRITION_ENTRY_INGREDIENTS_TABLE)
      .select("entry_id, name, calories, protein, carbs, fat, fiber_g, confidence")
      .in("entry_id", entryIds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn(
            "[macro-detail] nutrition_entry_ingredients fetch failed:",
            error.message,
          );
          setMacroDetailSnapshotRows([]);
          return;
        }
        setMacroDetailSnapshotRows(
          ((data ?? []) as NutritionEntryIngredientRow[]).map((row) =>
            toBreakdownSnapshotRow({
              entryId: row.entry_id,
              name: row.name,
              lowConfidence: isSnapshotRowLowConfidence(row),
              calories: row.calories,
              protein: row.protein,
              carbs: row.carbs,
              fat: row.fat,
              fiberG: row.fiber_g,
            }),
          ),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [macroDetailFlagEnabled, macroDetailMeals, macroDetailTarget]);

  return {
    macroDetailFlagEnabled,
    macroDetailTarget,
    setMacroDetailTarget,
    macroDetailMeals,
    macroDetailIngredientRows,
    macroDetailSnapshotRows,
    openMacroDetail,
    macroTapFromDialog,
  };
}
