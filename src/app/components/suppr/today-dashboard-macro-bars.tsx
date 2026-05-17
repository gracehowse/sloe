"use client";

import * as React from "react";
import { carbsLabel, netCarbsForRow } from "../../../lib/nutrition/netCarbs";
import { formatMacro } from "../../../lib/nutrition/formatMacro";
import { MACRO_COLOR_VARS } from "../../../lib/theme/macroColors";

/**
 * TodayDashboardMacroBars — alternative macro display: a vertical
 * stack of "Name … Value / Target" rows, each with a thin filled bar
 * below. Selectable via Settings → Display → Macro display.
 *
 * Mirrors `apps/mobile/components/today/TodayDashboardMacroBars.tsx`.
 * The tiles variant remains the default; Grace asked for bars as a
 * user-configurable alternative (Cronometer / Lose It aesthetic;
 * packs more macros per vertical inch).
 */

export const TODAY_REF_SUGAR_G = 50;
export const TODAY_REF_SODIUM_MG = 2300;

export interface TodayDashboardMacroBarsProps {
  trackedMacros: string[];
  proteinCurrent: number;
  proteinTarget: number;
  carbsCurrent: number;
  carbsTarget: number;
  fatCurrent: number;
  fatTarget: number;
  fiberCurrent: number;
  fiberTarget: number;
  sugarG: number;
  sodiumMg: number;
  waterCurrentMl: number;
  waterTargetMl: number;
  netCarbsLensEnabled?: boolean;
  onPressMacro?: (macro: string) => void;
}

type BarDef = {
  label: string;
  current: number;
  target: number;
  /** CSS color token from the Tailwind theme (`--protein`, `--carbs`, ...). */
  colorVar: string;
  unit: string;
};

export function TodayDashboardMacroBars({
  trackedMacros,
  proteinCurrent,
  proteinTarget,
  carbsCurrent,
  carbsTarget,
  fatCurrent,
  fatTarget,
  fiberCurrent,
  fiberTarget,
  sugarG,
  sodiumMg,
  waterCurrentMl,
  waterTargetMl,
  netCarbsLensEnabled,
  onPressMacro,
}: TodayDashboardMacroBarsProps) {
  // Colors mirror `MACRO_COLOR_VARS` from `src/lib/theme/macroColors.ts`
  // (the canonical web macro palette). Uses CSS-var references so
  // dark-mode swaps automatically when theme.css remaps the `--macro-*`
  // tokens.
  const barMap: Record<string, BarDef> = {
    protein: {
      label: "Protein",
      current: proteinCurrent,
      target: proteinTarget,
      colorVar: MACRO_COLOR_VARS.protein,
      unit: "g",
    },
    carbs: {
      label: carbsLabel(fiberTarget, Boolean(netCarbsLensEnabled)),
      current: netCarbsForRow(
        carbsCurrent,
        fiberCurrent,
        Boolean(netCarbsLensEnabled),
      ),
      target: netCarbsForRow(
        carbsTarget,
        fiberTarget,
        Boolean(netCarbsLensEnabled),
      ),
      colorVar: MACRO_COLOR_VARS.carbs,
      unit: "g",
    },
    fat: {
      label: "Fat",
      current: fatCurrent,
      target: fatTarget,
      colorVar: MACRO_COLOR_VARS.fat,
      unit: "g",
    },
    fiber: {
      label: "Fiber",
      current: fiberCurrent,
      target: fiberTarget,
      colorVar: MACRO_COLOR_VARS.fiber,
      unit: "g",
    },
    sugar: {
      label: "Sugar",
      current: sugarG,
      target: TODAY_REF_SUGAR_G,
      colorVar: MACRO_COLOR_VARS.sugar,
      unit: "g",
    },
    sodium: {
      label: "Sodium",
      current: sodiumMg,
      target: TODAY_REF_SODIUM_MG,
      colorVar: MACRO_COLOR_VARS.sodium,
      unit: "mg",
    },
    water: {
      label: "Water",
      current: waterCurrentMl,
      target: waterTargetMl,
      colorVar: MACRO_COLOR_VARS.water,
      unit: "ml",
    },
  };

  return (
    <div
      className="bg-card border border-border rounded-2xl p-4 mb-3 flex flex-col gap-4"
      data-testid="today-macro-bars"
    >
      {trackedMacros.map((macro) => {
        const def = barMap[macro];
        if (!def) return null;
        const value = formatMacro(def.current, macro);
        const targetLabel = formatMacro(def.target, macro);
        const pct =
          def.target > 0
            ? Math.min(100, Math.max(0, (def.current / def.target) * 100))
            : 0;
        const Row = (
          <>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[15px] font-semibold text-foreground">
                {def.label}
              </span>
              <span className="text-[13px] text-muted-foreground tabular-nums ph-mask">
                <span className="font-bold text-foreground">{value}</span>
                {" / "}
                {targetLabel} {def.unit}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: def.colorVar,
                }}
              />
            </div>
          </>
        );
        if (onPressMacro) {
          return (
            <button
              key={macro}
              type="button"
              onClick={() => onPressMacro(macro)}
              className="text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              aria-label={`${def.label}: ${value} of ${targetLabel} ${def.unit}`}
              data-testid={`today-macro-bar-${macro}`}
            >
              {Row}
            </button>
          );
        }
        return (
          <div key={macro} data-testid={`today-macro-bar-${macro}`}>
            {Row}
          </div>
        );
      })}
    </div>
  );
}
