"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  deriveIngredientBreakdown,
  toBreakdownEntry,
  type BreakdownIngredientRow,
  type BreakdownMacro,
} from "@/lib/nutrition/macroIngredientBreakdown";

export type MacroKey = "protein" | "carbs" | "fat" | "fiber" | "calories";

export interface MacroMeal {
  name: string;
  recipeTitle: string;
  /**
   * Optional fields used by the "By ingredient" breakdown (ENG-748 #10). When
   * absent, the meal still renders in the "By meal" view; the ingredient view
   * falls back to a self-named line for that entry.
   */
  id?: string;
  recipeId?: string | null;
  portionMultiplier?: number | null;
  [key: string]: number | string | null | undefined;
}

export interface MacroDetailPanelProps {
  macro: MacroKey;
  meals: MacroMeal[];
  open: boolean;
  onClose: () => void;
  /**
   * Base-servings `recipe_ingredients` rows for the day's recipes (one batched
   * query, keyed by recipeId). Optional — when omitted the "By ingredient" view
   * falls back to one self-named line per entry. The CALLER does the I/O
   * (mirrors the mobile macro-detail screen): fetch the day's distinct non-null
   * recipe_ids and run a single `.in("recipe_id", ids)` query.
   */
  ingredientRows?: BreakdownIngredientRow[];
}

const MACRO_CONFIG: Record<
  MacroKey,
  { label: string; cssVar: string; unit: string }
> = {
  protein: { label: "Protein", cssVar: "var(--macro-protein)", unit: "g" },
  carbs: { label: "Carbs", cssVar: "var(--macro-carbs)", unit: "g" },
  fat: { label: "Fat", cssVar: "var(--macro-fat)", unit: "g" },
  fiber: { label: "Fiber", cssVar: "var(--success)", unit: "g" },
  calories: { label: "Calories", cssVar: "var(--macro-calories)", unit: "kcal" },
};

type BreakdownMode = "meal" | "ingredient";

/**
 * Look up the numeric value for the given macro from a meal record.
 *
 * Handles both the direct key ("protein", "carbs", "fat", "calories") and the
 * mobile-style key ("fiberG") for fiber.
 */
export function getMacroValue(meal: MacroMeal, macro: MacroKey): number {
  if (macro === "fiber") {
    const v = meal.fiberG ?? meal.fiber ?? 0;
    return typeof v === "number" ? v : Number(v) || 0;
  }
  const v = meal[macro] ?? 0;
  return typeof v === "number" ? v : Number(v) || 0;
}

/**
 * MacroDetailPanel -- Per-meal / per-ingredient breakdown of a specific macro.
 *
 * "By meal" lists each logged meal with the macro value + a proportion bar.
 * "By ingredient" (ENG-748 #10) derives each logged recipe's ingredient
 * contributions (ingredient base-servings macro × entry portion_multiplier,
 * reconciled to the entry's stored total) via the shared web+mobile helper.
 * Matches apps/mobile/app/macro-detail.tsx.
 */
export function MacroDetailPanel({
  macro,
  meals,
  open,
  onClose,
  ingredientRows,
}: MacroDetailPanelProps) {
  const config = MACRO_CONFIG[macro];
  const [mode, setMode] = useState<BreakdownMode>("meal");

  const { total, mealValues } = useMemo(() => {
    const values = meals.map((meal) => ({
      meal,
      value: getMacroValue(meal, macro),
    }));
    const sum = values.reduce((acc, v) => acc + v.value, 0);
    return { total: sum, mealValues: values };
  }, [meals, macro]);

  // Derive the per-ingredient breakdown via the SHARED helper (same module
  // mobile uses) so the scale/reconcile logic is single-sourced.
  const ingredientBreakdown = useMemo(() => {
    const entries = meals.map((m) =>
      toBreakdownEntry({
        id: m.id ?? "",
        name: m.name,
        recipeTitle: m.recipeTitle,
        recipeId: m.recipeId ?? null,
        portionMultiplier: m.portionMultiplier ?? 1,
        calories: typeof m.calories === "number" ? m.calories : Number(m.calories) || 0,
        protein: typeof m.protein === "number" ? m.protein : Number(m.protein) || 0,
        carbs: typeof m.carbs === "number" ? m.carbs : Number(m.carbs) || 0,
        fat: typeof m.fat === "number" ? m.fat : Number(m.fat) || 0,
        fiberG: getMacroValue(m, "fiber"),
      }),
    );
    return deriveIngredientBreakdown(entries, ingredientRows ?? [], macro as BreakdownMacro);
  }, [meals, ingredientRows, macro]);

  const formatValue = (v: number): string => {
    const rounded = Math.round(v * 10) / 10;
    return `${rounded}${config.unit}`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {config.label} Breakdown
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {mode === "meal"
              ? `Per-meal ${config.label.toLowerCase()} breakdown for today.`
              : `Per-ingredient ${config.label.toLowerCase()} breakdown for today.`}
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          {meals.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No meals logged for this day.
            </p>
          ) : (
            <>
              {/* Segmented toggle: By meal / By ingredient. Mirrors the mobile
                  macro-detail screen control. */}
              <div
                role="tablist"
                aria-label="Breakdown mode"
                className="mb-3 flex gap-0.5 rounded-full bg-muted p-0.5"
              >
                {(["meal", "ingredient"] as const).map((m) => {
                  const isActive = mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={m === "meal" ? "By meal" : "By ingredient"}
                      onClick={() => setMode(m)}
                      className={`flex-1 rounded-full py-1.5 text-[13px] transition-colors ${
                        isActive
                          ? "bg-card font-bold text-foreground shadow-sm"
                          : "font-medium text-muted-foreground"
                      }`}
                    >
                      {m === "meal" ? "By meal" : "By ingredient"}
                    </button>
                  );
                })}
              </div>

              {mode === "ingredient" ? (
                <div data-testid="macro-detail-ingredient-list" className="divide-y divide-border">
                  {ingredientBreakdown.lines.map((line, i) => {
                    const pct =
                      ingredientBreakdown.total > 0
                        ? line.value / ingredientBreakdown.total
                        : 0;
                    return (
                      <div key={`${line.name}-${i}`} className="flex items-center gap-3 py-3">
                        <div
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: config.cssVar, opacity: 0.3 + pct * 0.7 }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {line.name}
                          </p>
                        </div>
                        <span
                          className="shrink-0 text-sm font-bold tabular-nums"
                          style={{ color: config.cssVar }}
                        >
                          {formatValue(line.value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  {/* Meal list */}
                  <div className="divide-y divide-border">
                    {mealValues.map(({ meal, value }, i) => {
                      const pct = total > 0 ? value / total : 0;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 py-3"
                        >
                          {/* Proportion dot */}
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: config.cssVar,
                              opacity: 0.3 + pct * 0.7,
                            }}
                          />

                          {/* Meal info */}
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {meal.name}
                            </p>
                            <p className="truncate text-sm font-medium text-foreground">
                              {meal.recipeTitle}
                            </p>
                          </div>

                          {/* Value */}
                          <span
                            className="shrink-0 text-sm font-bold tabular-nums"
                            style={{ color: config.cssVar }}
                          >
                            {formatValue(value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Visual breakdown bar */}
                  <div
                    className="mt-4 rounded-lg p-3"
                    style={{ backgroundColor: `color-mix(in srgb, ${config.cssVar} 8%, transparent)` }}
                  >
                    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-border">
                      {mealValues.map(({ value }, i) => {
                        const pct = total > 0 ? (value / total) * 100 : 0;
                        return (
                          <div
                            key={i}
                            className="h-full"
                            style={{
                              width: `${Math.max(pct, 1)}%`,
                              backgroundColor: config.cssVar,
                              opacity: 0.4 + (i % 3) * 0.2,
                            }}
                          />
                        );
                      })}
                    </div>
                    <p className="mt-2 text-center text-[11px] text-muted-foreground">
                      {formatValue(total)} across {meals.length} meal{meals.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </>
              )}

              {/* Total */}
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-bold text-foreground">Total</span>
                <span
                  className="text-base font-extrabold tabular-nums"
                  style={{ color: config.cssVar }}
                >
                  {formatValue(mode === "ingredient" ? ingredientBreakdown.total : total)}
                </span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
