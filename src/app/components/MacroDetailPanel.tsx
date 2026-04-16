"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

export type MacroKey = "protein" | "carbs" | "fat" | "fiber" | "calories";

export interface MacroMeal {
  name: string;
  recipeTitle: string;
  [key: string]: number | string;
}

export interface MacroDetailPanelProps {
  macro: MacroKey;
  meals: MacroMeal[];
  open: boolean;
  onClose: () => void;
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
 * MacroDetailPanel -- Per-meal breakdown of a specific macro.
 *
 * Shows a list of meals with the macro value and a proportion bar, plus a
 * total at the bottom. Matches the layout of apps/mobile/app/macro-detail.tsx.
 */
export function MacroDetailPanel({
  macro,
  meals,
  open,
  onClose,
}: MacroDetailPanelProps) {
  const config = MACRO_CONFIG[macro];

  const { total, mealValues } = useMemo(() => {
    const values = meals.map((meal) => ({
      meal,
      value: getMacroValue(meal, macro),
    }));
    const sum = values.reduce((acc, v) => acc + v.value, 0);
    return { total: sum, mealValues: values };
  }, [meals, macro]);

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
            Per-meal {config.label.toLowerCase()} breakdown for today.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          {meals.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No meals logged for this day.
            </p>
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

              {/* Total */}
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-bold text-foreground">Total</span>
                <span
                  className="text-base font-extrabold tabular-nums"
                  style={{ color: config.cssVar }}
                >
                  {formatValue(total)}
                </span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
