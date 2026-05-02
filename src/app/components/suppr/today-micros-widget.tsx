"use client";

import * as React from "react";
import {
  dailyValuePercent,
  isLimitNutrient,
} from "../../../lib/nutrition/dailyValues";

/**
 * TodayMicrosWidget — 4 horizontal-scroll micronutrient tiles for Today (web).
 *
 * Mirrors `apps/mobile/components/today/TodayMicrosWidget.tsx`. Audit
 * gap #1: surface fibre / iron / vitamin D / sodium %DV so the
 * Cronometer power-user persona doesn't bounce on "Suppr is just a
 * macro tracker".
 *
 * Scope is intentionally narrow:
 *  - 4 tiles: Fibre, Iron, Vitamin D, Sodium.
 *  - %DV bar derived from `dailyValuePercent` (FDA 2020 reference).
 *  - No bottom sheet, no settings toggle, no full nutrient panel.
 *
 * Sodium colour ramp: success below 80% of the 2300mg limit, warning
 * 80%-99%, danger 100%+. Other nutrients stay green.
 */
export interface TodayMicrosWidgetProps {
  /** Day-summed micros — pass `sumMicrosFromLoggedMeals(meals)` directly. */
  microSum: Record<string, number> | null | undefined;
  /** Day-totalled fibre in grams (uses the dedicated meal-column path). */
  fiberG: number;
}

type TileKey = "fiberG" | "ironMg" | "vitaminDMcg" | "sodiumMg";

type TileSpec = {
  key: TileKey;
  label: string;
  unit: "g" | "mg" | "mcg";
  reference: number;
};

const TILE_SPECS: ReadonlyArray<TileSpec> = [
  { key: "fiberG", label: "Fiber", unit: "g", reference: 28 },
  { key: "ironMg", label: "Iron", unit: "mg", reference: 18 },
  { key: "vitaminDMcg", label: "Vit D", unit: "mcg", reference: 20 },
  { key: "sodiumMg", label: "Sodium", unit: "mg", reference: 2300 },
];

function tileColorVar(key: TileKey, pct: number | null): string {
  if (pct === null) return "var(--success)";
  if (!isLimitNutrient(key)) return "var(--success)";
  if (pct >= 100) return "var(--destructive)";
  if (pct >= 80) return "var(--warning)";
  return "var(--success)";
}

function formatAmount(amount: number, unit: TileSpec["unit"]): string {
  if (unit === "g") return `${Math.round(amount)}g`;
  if (unit === "mg") return `${Math.round(amount)}mg`;
  return `${Math.round(amount)}mcg`;
}

export function TodayMicrosWidget({ microSum, fiberG }: TodayMicrosWidgetProps) {
  const sum = microSum ?? {};

  return (
    <div className="mb-4" aria-label="Micronutrients">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Micronutrients
      </p>
      <div
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
        style={{ scrollbarWidth: "none" }}
      >
        {TILE_SPECS.map((spec) => {
          const amount =
            spec.key === "fiberG"
              ? fiberG
              : typeof sum[spec.key] === "number" && Number.isFinite(sum[spec.key])
                ? sum[spec.key]
                : 0;
          const pct = dailyValuePercent(spec.key, amount);
          const colorVar = tileColorVar(spec.key, pct);
          const barWidthPct = Math.min(100, Math.max(0, pct ?? 0));

          return (
            <div
              key={spec.key}
              data-testid={`today-micros-tile-${spec.key}`}
              className="shrink-0 w-[144px] rounded-[14px] bg-card border border-border p-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {spec.label}
              </p>
              <p className="text-[15px] font-bold tabular-nums text-foreground mb-1 truncate">
                {formatAmount(amount, spec.unit)}{" "}
                <span className="text-xs font-medium text-muted-foreground">
                  / {spec.reference}
                  {spec.unit}
                </span>
              </p>
              <div
                data-testid={`today-micros-bar-${spec.key}`}
                role="progressbar"
                aria-valuenow={pct ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${spec.label} ${pct ?? 0}% of daily value`}
                className="h-[6px] rounded-full overflow-hidden"
                style={{
                  background: `color-mix(in oklab, ${colorVar} 14%, transparent)`,
                }}
              >
                <div
                  data-testid={`today-micros-bar-fill-${spec.key}`}
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${barWidthPct}%`,
                    background: colorVar,
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">
                {pct === null ? "—" : `${pct}% DV`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TodayMicrosWidget;
