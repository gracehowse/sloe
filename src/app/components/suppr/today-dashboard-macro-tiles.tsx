"use client";

import * as React from "react";
import { Icons } from "../ui/icons";
import { MacroCard } from "./macro-card";

/**
 * TodayDashboardMacroTiles — macro tiles grid driven by `trackedMacros`.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). Matches
 * the mobile `trackedMacros` ordering and keys (protein, carbs, fat,
 * fiber, sugar, sodium, water).
 */

export const TODAY_REF_SUGAR_G = 50;
export const TODAY_REF_SODIUM_MG = 2300;

export interface TodayDashboardMacroTilesProps {
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
  formatWaterLine: (ml: number) => string;
  onAddWaterMl: (ml: number) => void;
}

export function TodayDashboardMacroTiles({
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
  formatWaterLine,
  onAddWaterMl,
}: TodayDashboardMacroTilesProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {trackedMacros.map((macroKey) => {
        if (macroKey === "protein") {
          return (
            <MacroCard
              key="protein"
              className="min-w-[92px] flex-1"
              macro="protein"
              value={proteinCurrent}
              target={proteinTarget}
            />
          );
        }
        if (macroKey === "carbs") {
          return (
            <MacroCard key="carbs" className="min-w-[92px] flex-1" macro="carbs" value={carbsCurrent} target={carbsTarget} />
          );
        }
        if (macroKey === "fat") {
          return (
            <MacroCard key="fat" className="min-w-[92px] flex-1" macro="fat" value={fatCurrent} target={fatTarget} />
          );
        }
        if (macroKey === "fiber") {
          const cur = fiberCurrent;
          const tgt = fiberTarget;
          const pct = tgt > 0 ? Math.min((cur / tgt) * 100, 100) : 0;
          return (
            <div key="fiber" className="flex-1 min-w-[92px] flex flex-col rounded-card bg-card p-2.5 border border-border">
              <div className="flex items-center gap-1 mb-1">
                <div className="h-2 w-2 rounded-sm bg-[var(--success)]" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fiber</span>
              </div>
              <div className="text-base font-bold tabular-nums text-foreground">{Math.round(cur * 10) / 10}g</div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-[var(--success)]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">of {tgt}g</span>
            </div>
          );
        }
        if (macroKey === "sugar") {
          const cur = sugarG;
          const tgt = TODAY_REF_SUGAR_G;
          const pct = tgt > 0 ? Math.min((cur / tgt) * 100, 100) : 0;
          return (
            <div key="sugar" className="flex-1 min-w-[92px] flex flex-col rounded-card bg-card p-2.5 border border-border">
              <div className="flex items-center gap-1 mb-1">
                <div className="h-2 w-2 rounded-sm bg-[var(--warning)]" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sugar</span>
              </div>
              <div className="text-base font-bold tabular-nums text-foreground">{Math.round(cur * 10) / 10}g</div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-[var(--warning)]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">ref {tgt}g</span>
            </div>
          );
        }
        if (macroKey === "sodium") {
          const cur = sodiumMg;
          const tgt = TODAY_REF_SODIUM_MG;
          const pct = tgt > 0 ? Math.min((cur / tgt) * 100, 100) : 0;
          return (
            <div key="sodium" className="flex-1 min-w-[92px] flex flex-col rounded-card bg-card p-2.5 border border-border">
              <div className="flex items-center gap-1 mb-1">
                <div className="h-2 w-2 rounded-sm bg-[var(--destructive)]" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sodium</span>
              </div>
              <div className="text-base font-bold tabular-nums text-foreground">{Math.round(cur)}mg</div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-[var(--destructive)]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">ref {tgt}mg</span>
            </div>
          );
        }
        if (macroKey === "water") {
          const cur = waterCurrentMl;
          const tgt = waterTargetMl;
          const pct = tgt > 0 ? Math.min((cur / tgt) * 100, 100) : 0;
          return (
            <div key="water" className="flex-1 min-w-[92px] flex flex-col rounded-card bg-card p-2.5 border border-border">
              <div className="flex items-center gap-1 mb-1">
                <Icons.water className="h-3 w-3 shrink-0 text-macro-water" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Water</span>
              </div>
              <div className="text-sm font-bold tabular-nums text-foreground leading-tight">{formatWaterLine(cur)}</div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-macro-water" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5">of {formatWaterLine(tgt)}</span>
              <div className="flex gap-1 mt-2">
                {([250, 500] as const).map((ml) => (
                  <button
                    key={ml}
                    type="button"
                    onClick={() => onAddWaterMl(ml)}
                    className="flex-1 px-1 py-1 rounded-md text-[9px] font-semibold bg-macro-water-soft text-macro-water border border-macro-water/30 hover:bg-macro-water/20 transition-colors"
                  >
                    +{ml}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
