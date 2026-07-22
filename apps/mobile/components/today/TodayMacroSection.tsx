import type { MacroDisplayStyle } from "@suppr/shared/preferences/macroDisplayStyle";
import {
  TodayDashboardMacroTiles,
  type TodayDashboardMacroTilesProps,
} from "./TodayDashboardMacroTiles";
import { TodayDashboardMacroBars } from "./TodayDashboardMacroBars";
import { TodayDashboardMacroRings } from "./TodayDashboardMacroRings";
import { isFeatureEnabled } from "@/lib/analytics";

/**
 * TodayMacroSection — the Sloe v3 Tiles / Bars / Rings switcher (mobile).
 *
 * Renders the macro block in the user's chosen `macroDisplayStyle`. Extracted
 * from `TodayScreen` (ENG-1224) so the 3-way switch lives in ONE place instead
 * of inflating the 7k-line legacy host — adding the `rings` branch here keeps
 * the pinned host file shrinking, not growing. Mirrors the web
 * `src/app/components/suppr/today-macro-section.tsx`.
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
        totals={props.totals}
        targets={props.targets}
        netCarbsLensEnabled={props.netCarbsLensEnabled}
        onPressMacro={props.onPressMacro}
      />
    );
  }
  return <TodayDashboardMacroTiles {...props} />;
}

export default TodayMacroSection;
