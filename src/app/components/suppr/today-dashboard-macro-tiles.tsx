"use client";

import * as React from "react";
import {
  Candy,
  Droplet,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { carbsLabel, netCarbsForRow } from "../../../lib/nutrition/netCarbs";
import { formatMacro } from "../../../lib/nutrition/formatMacro";
import { macroStatCaption } from "../../../lib/nutrition/macroStatCaption";
import { MACRO_ICONS } from "../../../lib/macroIconsLucide";
import { MACRO_COLOR_VARS, macroTextColorVarFor } from "../../../lib/theme/macroColors";
import { useCalmMode } from "../../../lib/preferences/useCalmMode";
import { isMacroDetailSupported } from "../MacroDetailPanel";

/**
 * TodayDashboardMacroTiles — macro tiles grid for Today.
 *
 * Rewritten 2026-04-20 to match the 2026-04-19 Claude Design
 * prototype's 2-column bigger tile treatment
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 *  → `MacroTile`). Each tile: uppercase name + lucide glyph → big
 * value + unit → progress bar → "X g remaining" or "X g over"
 * caption. The per-macro glyph is a `lucide-react` icon (never a
 * functional emoji — see `docs/decisions/2026-05-31-icon-strategy.md`,
 * ENG-808). Mirrors `apps/mobile/components/today/TodayDashboardMacroTiles.tsx`.
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
  /** Opens the host-owned per-macro detail panel for supported macro keys. */
  onPressMacro?: (macro: string) => void;
}

type TileMeta = {
  label: string;
  Icon: LucideIcon;
  valueText: string;
  targetText: string;
  pct: number;
  caption: string;
  /** Caption semantic — drives the caption colour (audit gap 4):
   *   - `under`     → "N g remaining" in success/sage
   *   - `over`      → "N g over" in amber (`--accent-warning-solid`)
   *   - `reference` → muted "ref N" for sugar/sodium
   *   - `none`      → suppressed (unlogged tile) */
  captionTone: "under" | "over" | "reference" | "none";
  /** True once the macro has any logged value — gap 8 softens the serif
   *  value to a muted tone while it's still a zero so the editorial numeral
   *  only earns its full ink weight when there's data. */
  hasValue: boolean;
  /** CSS color var (e.g. "var(--macro-protein)") for the progress fill. */
  fillVar: string;
  /** True when `current > target` on a tracked (non-ref) macro.
   *  Bar keeps the macro identity colour; caption uses destructive. */
  isOverBudget: boolean;
};

// Exported for unit coverage (ENG-986): asserts each tile consumes the
// shared macro-icon SSOT and that Water keeps its own Droplet glyph rather
// than borrowing the fat key.
export function buildMacroTile(
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

  const captionFor = (
    cur: number,
    tgt: number,
    unit: string,
    opts?: { referenceOnly?: boolean; overIsFlag?: boolean },
  ): { caption: string; tone: TileMeta["captionTone"] } => {
    const result = macroStatCaption({
      current: cur,
      target: tgt,
      unit,
      referenceOnly: opts?.referenceOnly,
      overIsFlag: opts?.overIsFlag ?? true,
    });
    return { caption: result.text, tone: result.tone };
  };

  if (macroKey === "protein") {
    const cur = proteinCurrent;
    const tgt = proteinTarget;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    const c = captionFor(cur, tgt, "g");
    return {
      label: "Protein",
      Icon: MACRO_ICONS.protein,
      valueText: formatMacro(cur, "protein"),
      targetText: `/ ${tgt} g`,
      pct,
      caption: c.caption,
      captionTone: c.tone,
      hasValue: cur > 0,
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
      Icon: MACRO_ICONS.carbs,
      valueText: formatMacro(cur, "carbs"),
      targetText: `/ ${formatMacro(tgt, "carbs")} g`,
      pct,
      caption: captionFor(cur, tgt, "g").caption,
      captionTone: captionFor(cur, tgt, "g").tone,
      hasValue: cur > 0,
      fillVar: MACRO_COLOR_VARS.carbs,
      isOverBudget: tgt > 0 && cur > tgt,
    };
  }
  if (macroKey === "fat") {
    const cur = fatCurrent;
    const tgt = fatTarget;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    const c = captionFor(cur, tgt, "g");
    return {
      label: "Fat",
      Icon: MACRO_ICONS.fat,
      valueText: formatMacro(cur, "fat"),
      targetText: `/ ${tgt} g`,
      pct,
      caption: c.caption,
      captionTone: c.tone,
      hasValue: cur > 0,
      fillVar: MACRO_COLOR_VARS.fat,
      isOverBudget: tgt > 0 && cur > tgt,
    };
  }
  if (macroKey === "fiber") {
    const cur = fiberCurrent;
    const tgt = fiberTarget;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    // Fibre over-target is a win, not a flag — no amber caption when over.
    const c = captionFor(cur, tgt, "g", { overIsFlag: false });
    return {
      label: "Fibre",
      Icon: MACRO_ICONS.fiber,
      valueText: formatMacro(cur, "fiber"),
      targetText: `/ ${tgt} g`,
      pct,
      caption: c.caption,
      captionTone: c.tone,
      hasValue: cur > 0,
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
      caption: captionFor(cur, tgt, "g", { referenceOnly: true }).caption,
      captionTone: "reference",
      hasValue: cur > 0,
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
      caption: captionFor(cur, tgt, "mg", { referenceOnly: true }).caption,
      captionTone: "reference",
      hasValue: cur > 0,
      fillVar: MACRO_COLOR_VARS.sodium,
      isOverBudget: false /* sodium is reference-only */,
    };
  }
  if (macroKey === "water") {
    const cur = waterCurrentMl;
    const tgt = waterTargetMl;
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    // Water over-target is a win, not a flag — no amber caption when over.
    const c = captionFor(cur, tgt, "ml", { overIsFlag: false });
    return {
      label: "Water",
      // ENG-986: Water is NOT a macro SSOT key — bind it to its own Droplet
      // glyph (matches mobile), not MACRO_ICONS.fat. Sharing the fat key only
      // worked because both resolve to Droplet today; it silently coupled
      // Water to Fat and broke parity with mobile.
      Icon: Droplet,
      valueText: formatWaterLine(cur),
      targetText: `/ ${formatWaterLine(tgt)}`,
      pct,
      caption: c.caption,
      captionTone: c.tone,
      hasValue: cur > 0,
      fillVar: MACRO_COLOR_VARS.water,
      isOverBudget: false /* water over-target is a win, not a flag */,
    };
  }
  return null;
}

export function TodayDashboardMacroTiles(props: TodayDashboardMacroTilesProps) {
  const { trackedMacros, onAddWaterMl, nutrientRows, onPressViewAllNutrients, viewAllNutrientsCount, onPressMacro } = props;
  const [calmMode] = useCalmMode();

  return (
    <div className="mb-3">
    <div className="grid grid-cols-2 border-t border-border max-w-[480px]">
      {trackedMacros.map((macroKey, idx) => {
        const tile = buildMacroTile(macroKey, props);
        if (!tile) return null;
        const { Icon } = tile;
        // ENG-1099 value-colour signal: empty → tertiary; on/under → macro hue;
        // over a flagged macro → amber + semibold (the second channel so Fat,
        // whose hue is already amber, still reads "over"). Calm mode neutralises.
        const overSignal = tile.captionTone === "over" && !calmMode;
        const tierValueStyle: React.CSSProperties = !tile.hasValue
          ? { color: "var(--foreground-tertiary)" }
          : overSignal
            ? { color: "var(--accent-warning-solid)", fontWeight: 600 }
            : { color: macroTextColorVarFor(macroKey) };
        const content = (
          <>
            {/* Proto `.mtile`: colored icon on the LEFT, then value/goal + label.
                (Grace 2026-06-25 hairline-grid conform; mobile parity.) */}
            <div className="flex items-center gap-3">
              <Icon
                size={18}
                strokeWidth={1.75}
                style={{ color: tile.fillVar }}
                aria-hidden
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline min-w-0 gap-1">
                  {/* soften the value while it's a zero — full ink only with data. */}
                  <span
                    className={`font-[family-name:var(--font-headline)] text-xl font-normal tabular-nums tracking-tight shrink-0 ${
                      tile.hasValue ? "text-foreground" : "text-foreground-tertiary"
                    }`}
                    style={tierValueStyle}
                  >
                    {tile.valueText}
                  </span>
                  <span className="text-xs text-foreground-tertiary truncate">
                    {tile.targetText}
                  </span>
                </div>
                <span className="block text-xs font-medium text-foreground-secondary">
                  {tile.label}
                </span>
              </div>
            </div>
            {/* Proto `.mtile` track: the COLORED progress bar ALWAYS shows — the
                prototype's defining macro-tile element (colour + fill = progress).
                Grace 2026-06-25: the bar-less tile read "flat". Un-strips ENG-1099's
                bar removal. No caption row (the prototype tile drops it — the
                over/under signal lives in the value colour above). */}
            <div
              className="mt-2 h-1 rounded-full overflow-hidden bg-border"
            >
              <div
                className="h-full rounded-full transition-[width] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]"
                style={{
                  width: `${tile.pct}%`,
                  background: tile.fillVar,
                  opacity: tile.label === "Sugar" || tile.label === "Sodium" ? 0.45 : 1,
                }}
              />
            </div>
          </>
        );
        // Proto `.mtile` hairline cell (Grace 2026-06-25): NO card — a grid cell
        // divided by hairlines (bottom on every cell, right on the left column
        // when it has a neighbour). Asymmetric x-padding pushes content off the
        // central divider. Replaces the old lifted rounded-tile look.
        const isLeftCol = idx % 2 === 0;
        const hasRight = idx + 1 < trackedMacros.length;
        const cellClass = `flex flex-col py-3.5 border-b border-border ${
          isLeftCol ? `pl-1 pr-4${hasRight ? " border-r border-border" : ""}` : "pl-4 pr-1"
        }`;
        // ENG-848 — only macros that actually open a detail panel render as
        // interactive buttons. Reference-only tiles (sugar/sodium/water) have
        // no breakdown, so they must render as plain, non-interactive elements
        // — no button role, no "Open … breakdown" label, no hover/focus/active
        // affordance. `isMacroDetailSupported` is the single source of truth
        // shared with the macro bars and the `openMacroDetail` handler.
        if (onPressMacro && isMacroDetailSupported(macroKey)) {
          return (
            <button
              key={macroKey}
              type="button"
              onClick={() => onPressMacro(macroKey)}
              className={`${cellClass} text-left transition-colors hover:bg-muted/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:bg-muted/30`}
              aria-label={`Open ${tile.label} breakdown`}
              data-testid={`today-macro-tile-${macroKey}`}
            >
              {content}
            </button>
          );
        }
        return (
          <div
            key={macroKey}
            className={cellClass}
            data-testid={`today-macro-tile-${macroKey}`}
          >
            {content}
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
              className="rounded-card border border-border bg-card px-3 py-2.5"
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
            className="mt-3 inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted/50 transition-colors"
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
