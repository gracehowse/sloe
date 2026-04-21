"use client";

import * as React from "react";
import {
  Beef,
  Candy,
  Droplet,
  Droplets,
  Gauge,
  Leaf,
  Wheat,
  type LucideIcon,
} from "lucide-react";

/**
 * TodayDashboardMacroTiles — macro tiles grid for Today.
 *
 * Rewritten 2026-04-20 to match the 2026-04-19 Claude Design
 * prototype's 2-column bigger tile treatment
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 *  → `MacroTile`). Each tile: uppercase name + emoji icon → big
 * value + unit → progress bar → "X g remaining" or "X g over"
 * caption. Mirrors `apps/mobile/components/today/TodayDashboardMacroTiles.tsx`.
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

type TileMeta = {
  label: string;
  Icon: LucideIcon;
  valueText: string;
  targetText: string;
  pct: number;
  caption: string;
  /** CSS color var (e.g. "var(--macro-protein)") for the progress fill. */
  fillVar: string;
};

function buildMacroTile(
  macroKey: string,
  props: TodayDashboardMacroTilesProps,
): TileMeta | null {
  const {
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
  } = props;

  const plainRemainingCaption = (cur: number, tgt: number, unit: string): string => {
    const remain = tgt - cur;
    const magnitude = Math.round(Math.abs(remain));
    return remain >= 0
      ? `${magnitude} ${unit} remaining`
      : `${magnitude} ${unit} over`;
  };

  if (macroKey === "protein") {
    const cur = proteinCurrent;
    const tgt = proteinTarget;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    return {
      label: "Protein",
      Icon: Beef,
      valueText: `${Math.round(cur)}`,
      targetText: `/ ${tgt} g`,
      pct,
      caption: plainRemainingCaption(cur, tgt, "g"),
      fillVar: "var(--macro-protein)",
    };
  }
  if (macroKey === "carbs") {
    const cur = carbsCurrent;
    const tgt = carbsTarget;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    return {
      label: "Carbs",
      Icon: Wheat,
      valueText: `${Math.round(cur)}`,
      targetText: `/ ${tgt} g`,
      pct,
      caption: plainRemainingCaption(cur, tgt, "g"),
      fillVar: "var(--macro-carbs)",
    };
  }
  if (macroKey === "fat") {
    const cur = fatCurrent;
    const tgt = fatTarget;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    return {
      label: "Fat",
      Icon: Droplets,
      valueText: `${Math.round(cur)}`,
      targetText: `/ ${tgt} g`,
      pct,
      caption: plainRemainingCaption(cur, tgt, "g"),
      fillVar: "var(--macro-fat)",
    };
  }
  if (macroKey === "fiber") {
    const cur = fiberCurrent;
    const tgt = fiberTarget;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    return {
      label: "Fiber",
      Icon: Leaf,
      valueText: `${Math.round(cur * 10) / 10}`,
      targetText: `/ ${tgt} g`,
      pct,
      caption: plainRemainingCaption(cur, tgt, "g"),
      fillVar: "var(--success)",
    };
  }
  if (macroKey === "sugar") {
    const cur = sugarG;
    const tgt = TODAY_REF_SUGAR_G;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    return {
      label: "Sugar",
      Icon: Candy,
      valueText: `${Math.round(cur * 10) / 10}`,
      targetText: `/ ${tgt} g`,
      pct,
      caption: `ref ${tgt} g`,
      fillVar: "var(--warning)",
    };
  }
  if (macroKey === "sodium") {
    const cur = sodiumMg;
    const tgt = TODAY_REF_SODIUM_MG;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    return {
      label: "Sodium",
      Icon: Gauge,
      valueText: `${Math.round(cur)}`,
      targetText: `/ ${tgt} mg`,
      pct,
      caption: `ref ${tgt} mg`,
      fillVar: "var(--destructive)",
    };
  }
  if (macroKey === "water") {
    const cur = waterCurrentMl;
    const tgt = waterTargetMl;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    return {
      label: "Water",
      Icon: Droplet,
      valueText: formatWaterLine(cur),
      targetText: `/ ${formatWaterLine(tgt)}`,
      pct,
      caption: plainRemainingCaption(cur, tgt, "ml"),
      fillVar: "var(--macro-water, var(--primary))",
    };
  }
  return null;
}

export function TodayDashboardMacroTiles(props: TodayDashboardMacroTilesProps) {
  const { trackedMacros, onAddWaterMl } = props;

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {trackedMacros.map((macroKey) => {
        const tile = buildMacroTile(macroKey, props);
        if (!tile) return null;
        const { Icon } = tile;
        return (
          <div
            key={macroKey}
            className="rounded-[14px] bg-card border border-border p-3.5 flex flex-col"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tile.label}
              </span>
              <Icon
                size={13}
                strokeWidth={1.75}
                style={{ color: tile.fillVar }}
                aria-hidden
              />
            </div>
            <div className="flex items-baseline">
              <span className="text-[18px] font-bold tabular-nums text-foreground -tracking-[0.02em]">
                {tile.valueText}
              </span>
              <span className="text-xs text-muted-foreground ml-[3px]">
                {tile.targetText}
              </span>
            </div>
            <div className="mt-2.5 h-[5px] rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${tile.pct}%`, background: tile.fillVar }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">
              {tile.caption}
            </span>
            {macroKey === "water" ? (
              <div className="flex gap-1 mt-2">
                {([250, 500] as const).map((ml) => (
                  <button
                    key={ml}
                    type="button"
                    onClick={() => onAddWaterMl(ml)}
                    className="flex-1 px-1 py-1 rounded-md text-[9px] font-semibold bg-[color-mix(in_oklab,var(--macro-water,var(--primary))_12%,transparent)] text-[var(--macro-water,var(--primary))] border border-[color-mix(in_oklab,var(--macro-water,var(--primary))_30%,transparent)] hover:bg-[color-mix(in_oklab,var(--macro-water,var(--primary))_20%,transparent)] transition-colors"
                    aria-label={`Add ${ml}ml water`}
                  >
                    +{ml}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
