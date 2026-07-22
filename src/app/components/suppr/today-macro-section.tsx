"use client";

import * as React from "react";
import type { MacroDisplayStyle } from "../../../lib/preferences/macroDisplayStyle";
import {
  TodayDashboardMacroTiles,
  type TodayDashboardMacroTilesProps,
} from "./today-dashboard-macro-tiles";
import { TodayDashboardMacroBars } from "./today-dashboard-macro-bars";
import { TodayDashboardMacroRings } from "./today-dashboard-macro-rings";
import { isFeatureEnabled } from "../../../lib/analytics/track";

/**
 * TodayMacroSection — the Sloe v3 Tiles / Bars / Rings switcher.
 *
 * Renders the macro block in the user's chosen `macroDisplayStyle`. Extracted
 * from `NutritionTracker` / mobile `TodayScreen` (ENG-1224) so the 3-way switch
 * lives in ONE place instead of inflating the legacy host screens — adding the
 * `rings` branch here keeps the pinned host files shrinking, not growing.
 * `TodayDashboardMacroTilesProps` is the superset (bars + rings read a subset).
 * Mirrors `apps/mobile/components/today/TodayMacroSection.tsx`.
 */
export interface TodayMacroSectionProps extends TodayDashboardMacroTilesProps {
  macroDisplayStyle: MacroDisplayStyle;
}

export function TodayMacroSection({
  macroDisplayStyle,
  ...props
}: TodayMacroSectionProps) {
  // ENG-1656 — canonical bars band; honour user pref only when flag is off.
  const style = isFeatureEnabled("today_hero_macro_legend_v1")
    ? "bars"
    : macroDisplayStyle;
  if (style === "bars") {
    return <TodayDashboardMacroBars {...props} />;
  }
  if (style === "rings") {
    return (
      <TodayDashboardMacroRings
        proteinCurrent={props.proteinCurrent}
        proteinTarget={props.proteinTarget}
        carbsCurrent={props.carbsCurrent}
        carbsTarget={props.carbsTarget}
        fatCurrent={props.fatCurrent}
        fatTarget={props.fatTarget}
        fiberCurrent={props.fiberCurrent}
        fiberTarget={props.fiberTarget}
        netCarbsLensEnabled={props.netCarbsLensEnabled}
        onPressMacro={
          props.onPressMacro
            ? (macro) => props.onPressMacro?.(macro)
            : undefined
        }
      />
    );
  }
  return <TodayDashboardMacroTiles {...props} />;
}

export default TodayMacroSection;
