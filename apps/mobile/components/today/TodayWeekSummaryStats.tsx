import { Text, View } from "react-native";
import { Accent, FontFamily } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";

/**
 * TodayWeekSummaryStats — the "Weekly summary" tile trio (Total kcal / Daily
 * avg / Net deficit-surplus) on `TodayWeekView`. Extracted out of that file
 * (ENG-1372 slice 2) so the sparse-stats addition didn't push the pinned
 * 643-line host over its `scripts/screen-line-budget.json` ceiling.
 *
 * ENG-1372 slice 2 (law 3) — an average from <3 data points is a derived
 * stat with nothing behind it yet. Below 3 logged days, the middle tile
 * suppresses "Daily avg" and shows the honest stat instead: how many of the
 * 7 days actually have data ("{n}/7 days logged"). Folded onto the SAME
 * `empty_state_grammar_v1` flag slice 1 shipped — no new flag.
 *
 * Web parity: `src/app/components/suppr/today-week-summary-stats.tsx`.
 */
export interface TodayWeekSummaryStatsProps {
  totalCalories: number;
  avgCalories: number;
  daysWithFood: number;
  /** F-146 (2026-05-10) — sum of (basal + activity) burn across the visible
   *  week; falls back to `maintenanceKcal x 7` when not plumbed. */
  weekBurnTotal?: number;
  maintenanceKcal: number;
  accentPrimarySolid: string;
  textColor: string;
  textSecondaryColor: string;
  cardStyle: Record<string, any>;
  cardTitleStyle: Record<string, any>;
}

export function TodayWeekSummaryStats({
  totalCalories,
  avgCalories,
  daysWithFood,
  weekBurnTotal,
  maintenanceKcal,
  accentPrimarySolid,
  textColor,
  textSecondaryColor,
  cardStyle,
  cardTitleStyle,
}: TodayWeekSummaryStatsProps) {
  const showDaysLogged = daysWithFood < 3 && isFeatureEnabled("empty_state_grammar_v1");

  // F-146 (2026-05-10): the Net deficit/surplus tile compares
  // burn-vs-consumed (the truth), not goal-vs-consumed (which mislabels
  // deficits-above-goal as surplus). Falls back to `maintenanceKcal x 7`
  // when callers haven't been upgraded to plumb burn through.
  const burnReference =
    typeof weekBurnTotal === "number" && Number.isFinite(weekBurnTotal)
      ? weekBurnTotal
      : Math.max(0, maintenanceKcal) * 7;
  const inDeficit = burnReference >= totalCalories;
  const diff = Math.round(Math.abs(burnReference - totalCalories));

  return (
    <View style={cardStyle}>
      <Text style={cardTitleStyle}>Weekly summary</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 12 }}>
        {/* SLOE Phase 0: the weekly-summary big stat numerals read in
            Newsreader serif (the design system reserves big numerals for
            serif). Family carries the weight, so the sans `fontWeight: 800`
            is dropped; the labels below stay sans. */}
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: FontFamily.serifRegular, fontSize: 24, color: textColor, fontVariant: ["tabular-nums"] }}>
            {Math.round(totalCalories)}
          </Text>
          <Text style={{ fontSize: 11, color: textSecondaryColor }}>Total kcal</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          {showDaysLogged ? (
            <>
              <Text
                testID="today-week-days-logged-stat"
                style={{ fontFamily: FontFamily.serifRegular, fontSize: 24, color: accentPrimarySolid, fontVariant: ["tabular-nums"] }}
              >
                {daysWithFood}/7
              </Text>
              <Text style={{ fontSize: 11, color: textSecondaryColor }}>Days logged</Text>
            </>
          ) : (
            <>
              <Text style={{ fontFamily: FontFamily.serifRegular, fontSize: 24, color: accentPrimarySolid, fontVariant: ["tabular-nums"] }}>
                {Math.round(avgCalories)}
              </Text>
              <Text style={{ fontSize: 11, color: textSecondaryColor }}>Daily avg</Text>
            </>
          )}
        </View>
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              // SLOE Phase 0: big stat numeral in Newsreader serif (family
              // carries the weight; sans 800 dropped).
              fontFamily: FontFamily.serifRegular,
              fontSize: 24,
              // Amber on over-burn (true surplus), success on deficit.
              // Never red per project memory
              // (`feedback_no_quick_temp_fixes.md` + spec §1.4).
              color: inDeficit ? Accent.success : Accent.warning,
              fontVariant: ["tabular-nums"],
            }}
          >
            {diff}
          </Text>
          {/* User-sentiment audit (round 4, 2026-04-30): retired the
              punitive over/under-target labels in favour of the canonical
              "Net deficit" / "Net surplus" phrasing from
              `src/lib/copy/today.ts`. UCL Oct 2025 study + r/loseit data
              show punitive framing drives logging avoidance + ED-cohort
              harm. Web parity: same swap on `today-week-view.tsx`. */}
          <Text style={{ fontSize: 11, color: textSecondaryColor }}>
            {inDeficit ? "Net deficit" : "Net surplus"}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default TodayWeekSummaryStats;
