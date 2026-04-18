"use client";

import * as React from "react";
import { cn } from "../ui/utils";
import {
  computeRemaining,
  projectRemaining,
  type MacroConsumed,
  type MacroTargets,
  type RemainingMacros,
} from "@/lib/nutrition/remainingMacros";

/**
 * RemainingMacrosBar — compact row showing how many kcal / g of each
 * macro the user has left today. Rendered below the DailyRing on the
 * Today view.
 *
 * When a `candidate` portion is supplied (fit-this-in preview from
 * FoodSearch), a second "after" row shows the projected remaining
 * values if the user logged that portion.
 *
 * Over-budget → the number turns `--destructive` and we swap "left"
 * for "over" with a `+` prefix on the signed amount. No red shame
 * flash: the colour matches the ring's over-budget colour already
 * used in DailyRing, and the copy stays factual.
 *
 * Shape intentionally mirrors `apps/mobile/components/RemainingMacrosBar.tsx`.
 */

export interface RemainingMacrosBarProps {
  targets: MacroTargets;
  consumed: MacroConsumed;
  /** When provided, show a secondary "after logging this" row. */
  candidate?: MacroConsumed | null;
  className?: string;
}

type Column = {
  key: "calories" | "protein" | "carbs" | "fat" | "fiber";
  label: string;
  unit: string;
  color: string;
};

const BASE_COLUMNS: Column[] = [
  { key: "calories", label: "KCAL", unit: "kcal", color: "var(--macro-calories)" },
  { key: "protein", label: "PROTEIN", unit: "g", color: "var(--macro-protein)" },
  { key: "carbs", label: "CARBS", unit: "g", color: "var(--macro-carbs)" },
  { key: "fat", label: "FAT", unit: "g", color: "var(--macro-fat)" },
];

const FIBER_COLUMN: Column = {
  key: "fiber",
  label: "FIBER",
  unit: "g",
  color: "var(--success)",
};

const LABEL_FOR_ARIA: Record<Column["key"], string> = {
  calories: "calories",
  protein: "protein",
  carbs: "carbs",
  fat: "fat",
  fiber: "fiber",
};

function valueFor(remaining: RemainingMacros, key: Column["key"]): number | undefined {
  if (key === "fiber") return remaining.fiber;
  return remaining[key];
}

function deltaFor(remaining: RemainingMacros, key: Column["key"]): number | undefined {
  return remaining.deltas[key];
}

function overFor(remaining: RemainingMacros, key: Column["key"]): boolean {
  switch (key) {
    case "calories": return remaining.overCalories;
    case "protein": return remaining.overProtein;
    case "carbs": return remaining.overCarbs;
    case "fat": return remaining.overFat;
    case "fiber": return remaining.overFiber;
  }
}

function targetFor(targets: MacroTargets, key: Column["key"]): number {
  if (key === "fiber") return Math.max(0, Math.round(targets.fiber ?? 0));
  return Math.max(0, Math.round(targets[key]));
}

function RemainingMacrosBar({
  targets,
  consumed,
  candidate = null,
  className,
}: RemainingMacrosBarProps) {
  const currentRemaining = React.useMemo(
    () => computeRemaining(targets, consumed),
    [targets, consumed],
  );
  const projectedRemaining = React.useMemo(
    () => (candidate ? projectRemaining(targets, consumed, candidate) : null),
    [targets, consumed, candidate],
  );

  const includeFiber = typeof currentRemaining.fiber === "number";
  const columns: Column[] = includeFiber ? [...BASE_COLUMNS, FIBER_COLUMN] : BASE_COLUMNS;

  return (
    <div
      className={cn(
        "grid gap-2 rounded-card border border-border bg-card p-2.5",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      role="group"
      aria-label="Remaining daily macros"
    >
      {columns.map((col) => {
        const remainingValue = valueFor(currentRemaining, col.key);
        const over = overFor(currentRemaining, col.key);
        const delta = deltaFor(currentRemaining, col.key);
        // When over-budget, show the signed "+N over" from the delta.
        const display = over && delta != null ? `+${Math.abs(delta)}` : `${remainingValue ?? 0}`;
        const suffix = over ? "over" : "left";
        const target = targetFor(targets, col.key);
        const unit = col.unit;

        const ariaLabel = over
          ? `${Math.abs(delta ?? 0)} ${unit === "kcal" ? "kilocalories" : `grams of ${LABEL_FOR_ARIA[col.key]}`} over today's target`
          : `${remainingValue ?? 0} ${unit === "kcal" ? "kilocalories" : `grams of ${LABEL_FOR_ARIA[col.key]}`} remaining`;

        return (
          <div
            key={col.key}
            className="flex flex-col items-start min-w-0"
            aria-label={ariaLabel}
          >
            <div className="flex items-center gap-1 mb-0.5">
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: col.color }}
                aria-hidden="true"
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {col.label}
              </span>
            </div>
            <span
              className="tabular-nums text-lg font-bold leading-none"
              style={{ color: over ? "var(--destructive)" : "var(--foreground)" }}
            >
              {display}
              {unit === "g" && <span className="text-[10px] font-semibold ml-0.5">g</span>}
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
              {suffix}
              {" · /"}
              {target}
              {unit === "g" ? "g" : ""}
            </span>

            {projectedRemaining && (
              (() => {
                const pVal = valueFor(projectedRemaining, col.key);
                const pOver = overFor(projectedRemaining, col.key);
                const pDelta = deltaFor(projectedRemaining, col.key);
                const pDisplay = pOver && pDelta != null ? `+${Math.abs(pDelta)}` : `${pVal ?? 0}`;
                const pSuffix = pOver ? "over" : "left";
                const pAria = pOver
                  ? `After logging this, ${Math.abs(pDelta ?? 0)} ${unit === "kcal" ? "kilocalories" : `grams of ${LABEL_FOR_ARIA[col.key]}`} over`
                  : `After logging this, ${pVal ?? 0} ${unit === "kcal" ? "kilocalories" : `grams of ${LABEL_FOR_ARIA[col.key]}`} remaining`;
                return (
                  <div
                    className="mt-1 pt-1 border-t border-border/60 flex items-baseline gap-1"
                    aria-label={pAria}
                  >
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">after</span>
                    <span
                      className="tabular-nums text-xs font-semibold"
                      style={{ color: pOver ? "var(--destructive)" : "var(--foreground)" }}
                    >
                      {pDisplay}
                      {unit === "g" && <span className="text-[8px] ml-0.5">g</span>}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{pSuffix}</span>
                  </div>
                );
              })()
            )}
          </div>
        );
      })}
    </div>
  );
}

export { RemainingMacrosBar };
