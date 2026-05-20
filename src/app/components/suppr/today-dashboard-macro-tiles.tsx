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
import { carbsLabel, netCarbsForRow } from "../../../lib/nutrition/netCarbs";
import { formatMacro } from "../../../lib/nutrition/formatMacro";
import { MACRO_COLOR_VARS } from "../../../lib/theme/macroColors";

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
  /** P3-30 (2026-04-25): when true, the carbs tile shows "Net carbs"
   *  with the value computed via `netCarbsForRow(carbs, fibre, true)`
   *  (carbs - fibre, floored at 0). Default false preserves the
   *  current "Carbs" display. The lens silently falls back to "Carbs"
   *  when fibre is not tracked. */
  netCarbsLensEnabled?: boolean;
  /** Phase 4 / Top-5 #2 (2026-04-28) — non-macro nutrient rows for
   *  the active day (e.g. saturated fat, sodium, etc., computed via
   *  `buildDayNutrientDetailRows`). When present, renders a "Nutrients"
   *  sub-section below the tile grid as part of this component
   *  (instead of a standalone stacking block in the host).
   *
   *  Web parity divergence vs mobile is intentional: mobile opens a
   *  full modal because phone screen real estate is tight; web
   *  inlines the rows here because desktop has the room. Both
   *  surfaces achieve "the data is one tap / glance away from the
   *  macro tiles". Document divergence in
   *  `docs/ux/teardown-2026-04-28-daily-loop.md` execution log. */
  nutrientRows?: ReadonlyArray<{ key: string; label: string; value: string }>;
  /** When provided, renders a "View all N nutrients" pill below the
   *  inline `nutrientRows` that opens the host-owned full-nutrient
   *  panel sheet. Wired in 2026-05-02 (revert PR #30) so the
   *  Cronometer-parity panel from PR #47 still has an entry point on
   *  web after the TodayMicrosWidget was removed from Today's canvas.
   *  Mirrors the mobile "Nutrients" link → `FullNutrientPanelSheet`
   *  flow. */
  onPressViewAllNutrients?: () => void;
  /** The total nutrient count surfaced by the panel — used in the
   *  CTA copy ("View all 34 nutrients"). Defaults to a generic
   *  "View all nutrients" when omitted. */
  viewAllNutrientsCount?: number;
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
  /** True when `current > target` on a tracked (non-ref) macro.
   *  Bar keeps the macro identity colour; caption uses destructive. */
  isOverBudget: boolean;
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
    // Suppress caption on unlogged tiles — the `0 / target` line
    // above already says everything the user needs.
    if (cur <= 0 && tgt > 0) return "";
    const remain = tgt - cur;
    const magnitude = Math.round(Math.abs(remain));
    return remain >= 0
      ? `${magnitude} ${unit} left`
      : `${magnitude} ${unit} over`;
  };

  if (macroKey === "protein") {
    const cur = proteinCurrent;
    const tgt = proteinTarget;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    return {
      label: "Protein",
      Icon: Beef,
      valueText: formatMacro(cur, "protein"),
      targetText: `/ ${tgt} g`,
      pct,
      caption: plainRemainingCaption(cur, tgt, "g"),
      fillVar: MACRO_COLOR_VARS.protein,
      isOverBudget: tgt > 0 && cur > tgt,
    };
  }
  if (macroKey === "carbs") {
    // P3-30 (2026-04-25): apply the net-carbs lens when the user has
    // opted in AND fibre is tracked. The helpers refuse the "Net
    // carbs" label when fibre is unknown — prevents a misleading
    // headline when the underlying data can't support the math.
    const lensOn = Boolean(props.netCarbsLensEnabled);
    const curRaw = carbsCurrent;
    const tgtRaw = carbsTarget;
    const cur = netCarbsForRow(curRaw, fiberCurrent, lensOn);
    const tgt = netCarbsForRow(tgtRaw, fiberTarget, lensOn);
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    return {
      // Numbers audit 2026-05-04 #8: arbiter must be `fiberTarget`, not
      // `fiberCurrent`. With the net-carbs lens on and zero meals yet
      // logged today, `fiberCurrent` is 0 and `carbsLabel` falls back to
      // "Carbs" — so the user saw "Carbs 0 / 75g" with target net but
      // label gross. The target's fibre column tells us whether net-carbs
      // math is *defined* for this user, which is what the label should
      // track. Mobile fixed the same bug on 2026-04-30.
      label: carbsLabel(fiberTarget, lensOn),
      Icon: Wheat,
      valueText: formatMacro(cur, "carbs"),
      targetText: `/ ${formatMacro(tgt, "carbs")} g`,
      pct,
      caption: plainRemainingCaption(cur, tgt, "g"),
      fillVar: MACRO_COLOR_VARS.carbs,
      isOverBudget: tgt > 0 && cur > tgt,
    };
  }
  if (macroKey === "fat") {
    const cur = fatCurrent;
    const tgt = fatTarget;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    return {
      label: "Fat",
      Icon: Droplets,
      valueText: formatMacro(cur, "fat"),
      targetText: `/ ${tgt} g`,
      pct,
      caption: plainRemainingCaption(cur, tgt, "g"),
      fillVar: MACRO_COLOR_VARS.fat,
      isOverBudget: tgt > 0 && cur > tgt,
    };
  }
  if (macroKey === "fiber") {
    const cur = fiberCurrent;
    const tgt = fiberTarget;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    return {
      label: "Fiber",
      Icon: Leaf,
      valueText: formatMacro(cur, "fiber"),
      targetText: `/ ${tgt} g`,
      pct,
      caption: plainRemainingCaption(cur, tgt, "g"),
      fillVar: MACRO_COLOR_VARS.fiber,
      isOverBudget: false /* fibre over-target is not a flag -- it's a win */,
    };
  }
  if (macroKey === "sugar") {
    const cur = sugarG;
    const tgt = TODAY_REF_SUGAR_G;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    return {
      label: "Sugar",
      Icon: Candy,
      valueText: formatMacro(cur, "sugar"),
      targetText: `/ ${tgt} g`,
      pct,
      caption: `ref ${tgt} g`,
      fillVar: MACRO_COLOR_VARS.sugar,
      isOverBudget: false /* sugar is reference-only */,
    };
  }
  if (macroKey === "sodium") {
    const cur = sodiumMg;
    const tgt = TODAY_REF_SODIUM_MG;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    return {
      label: "Sodium",
      Icon: Gauge,
      valueText: formatMacro(cur, "sodium"),
      targetText: `/ ${tgt} mg`,
      pct,
      caption: `ref ${tgt} mg`,
      fillVar: MACRO_COLOR_VARS.sodium,
      isOverBudget: false /* sodium is reference-only */,
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
      fillVar: MACRO_COLOR_VARS.water,
      isOverBudget: false /* water over-target is a win, not a flag */,
    };
  }
  return null;
}

export function TodayDashboardMacroTiles(props: TodayDashboardMacroTilesProps) {
  const { trackedMacros, onAddWaterMl, nutrientRows, onPressViewAllNutrients, viewAllNutrientsCount } = props;

  return (
    <div className="mb-6">
    <div className="grid grid-cols-2 gap-4">
      {trackedMacros.map((macroKey) => {
        const tile = buildMacroTile(macroKey, props);
        if (!tile) return null;
        const { Icon } = tile;
        return (
          <div
            key={macroKey}
            className="rounded-[14px] bg-card border border-border p-4 flex flex-col"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tile.label}
              </span>
              <Icon
                size={14}
                strokeWidth={1.75}
                style={{ color: tile.fillVar }}
                aria-hidden
              />
            </div>
            {/* Prototype port (2026-04-20, mobile parity): value
                bumped from 18pt → 22pt per mobile's ui-critic fix so
                the number carries visual weight equal to the label
                above it. Target label gets `truncate` / overflow-hidden
                via `min-w-0` on the flex container so long imperial
                targets (e.g. "/ 1,200 ml" or "/ 2,300 mg") don't
                wrap to a second line. */}
            <div className="flex items-baseline min-w-0">
              <span className="text-[22px] font-bold tabular-nums text-foreground -tracking-[0.02em] shrink-0">
                {tile.valueText}
              </span>
              <span className="text-xs text-muted-foreground ml-[3px] truncate">
                {tile.targetText}
              </span>
            </div>
            {/* Hide bar on unlogged tiles; macro colour always on the fill. */}
            {tile.pct === 0 ? null : (
            <div
              className="mt-2.5 h-[6px] rounded-full overflow-hidden"
              style={{
                background: `color-mix(in_oklab, ${tile.fillVar} 14%, transparent)`,
              }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]"
                style={{
                  width: `${tile.pct}%`,
                  background: tile.fillVar,
                }}
              />
            </div>
            )}
            {tile.caption ? (
              <span
                className={`text-[11px] mt-1.5 tabular-nums ${
                  tile.isOverBudget
                    ? "font-bold text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {tile.caption}
              </span>
            ) : null}
            {macroKey === "water" ? (
              <div className="flex gap-1 mt-2">
                {([250, 500] as const).map((ml) => (
                  <button
                    key={ml}
                    type="button"
                    onClick={() => onAddWaterMl(ml)}
                    className="flex-1 px-1 py-1 rounded-md text-[9px] font-semibold bg-[color-mix(in_oklab,var(--macro-water)_12%,transparent)] text-[var(--macro-water)] border border-[color-mix(in_oklab,var(--macro-water)_30%,transparent)] hover:bg-[color-mix(in_oklab,var(--macro-water)_20%,transparent)] transition-colors"
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
    {/* Phase 4 / Top-5 #2 (2026-04-28) — non-macro nutrient rows
        embedded directly below the tile grid as part of this
        component, replacing the standalone block that previously
        stacked between the tiles and the meals section in the host.
        Renders only when the host passes ≥1 row. */}
    {nutrientRows && nutrientRows.length > 0 ? (
      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Nutrients
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {nutrientRows.map((row) => (
            <div
              key={row.key}
              className="rounded-xl border border-border bg-card px-3 py-2.5"
            >
              <p className="text-[10px] text-muted-foreground">{row.label}</p>
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {row.value}
              </p>
            </div>
          ))}
        </div>
        {/* "View all N nutrients" CTA pill — opens the
            FullNutrientPanelSheet (PR #47) on web. Wired 2026-05-02
            (revert PR #30) so the rich Cronometer-parity panel still
            has an entry point after the TodayMicrosWidget was removed.
            Mirrors mobile's "Nutrients" link → panel-sheet flow. */}
        {onPressViewAllNutrients ? (
          <button
            type="button"
            onClick={onPressViewAllNutrients}
            data-testid="today-view-all-nutrients-cta"
            aria-label={
              viewAllNutrientsCount
                ? `View all ${viewAllNutrientsCount} nutrients`
                : "View all nutrients"
            }
            className="mt-3 inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-semibold text-foreground hover:bg-muted/50 transition-colors"
          >
            {viewAllNutrientsCount
              ? `View all ${viewAllNutrientsCount} nutrients`
              : "View all nutrients"}
            <span aria-hidden className="text-muted-foreground">›</span>
          </button>
        ) : null}
      </div>
    ) : null}
    </div>
  );
}
