import { Text, View } from "react-native";
import { Accent, Type } from "@/constants/theme";
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
  /** ENG-1373 — `resolveMaintenance`-only value; `null` = no signal (never
   *  a fabricated `0`). `burnReference` below already treats null/0 alike. */
  maintenanceKcal: number | null;
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
      : Math.max(0, maintenanceKcal ?? 0) * 7;
  // ENG-1373 finding 5 — a user with no HealthKit basal/activity data AND
  // no resolvable maintenance (`profileMaintenanceTdeeKcal` null) drives
  // `burnReference` to exactly 0 via the fallback above. Comparing
  // `totalCalories` against a zero burn reference isn't a deficit/surplus
  // at all — it's "we have no burn signal" — so rendering e.g. "Net
  // surplus 12,600" fabricates a verdict from an absent denominator.
  // Suppress the verdict entirely in that case and fall back to the
  // honest days-logged stat instead.
  const hasBurnSignal = burnReference > 0;
  const inDeficit = hasBurnSignal && burnReference >= totalCalories;
  const diff = hasBurnSignal ? Math.round(Math.abs(burnReference - totalCalories)) : null;

  return (
    <View style={cardStyle}>
      <Text style={cardTitleStyle}>Weekly summary</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 12 }}>
        {/* SLOE Phase 0: the weekly-summary big stat numerals read in
            Newsreader serif (the design system reserves big numerals for
            serif). Family carries the weight, so the sans `fontWeight: 800`
            is dropped; the labels below stay sans. */}
        <View style={{ alignItems: "center" }}>
          <Text style={{ ...Type.title, color: textColor, fontVariant: ["tabular-nums"] }}>
            {Math.round(totalCalories)}
          </Text>
          <Text style={{ fontSize: 11, color: textSecondaryColor }}>Total kcal</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          {showDaysLogged ? (
            <>
              <Text
                testID="today-week-days-logged-stat"
                style={{ ...Type.title, color: accentPrimarySolid, fontVariant: ["tabular-nums"] }}
              >
                {daysWithFood}/7
              </Text>
              <Text style={{ fontSize: 11, color: textSecondaryColor }}>Days logged</Text>
            </>
          ) : (
            <>
              <Text style={{ ...Type.title, color: accentPrimarySolid, fontVariant: ["tabular-nums"] }}>
                {Math.round(avgCalories)}
              </Text>
              <Text style={{ fontSize: 11, color: textSecondaryColor }}>Daily avg</Text>
            </>
          )}
        </View>
        <View style={{ alignItems: "center" }}>
          {hasBurnSignal ? (
            <>
              <Text
                style={{
                  // SLOE Phase 0: big stat numeral in Newsreader serif (family
                  // carries the weight; sans 800 dropped).
                  ...Type.title,
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
            </>
          ) : (
            <>
              {/* ENG-1373 finding 5 — no burn signal (no HealthKit basal/
                  activity data AND no resolvable maintenance) means there's
                  nothing to compare intake against. Suppress the fabricated
                  verdict and show an honest em-dash + days-logged instead of
                  inventing a deficit/surplus from a zero denominator. */}
              <Text
                testID="today-week-net-burn-unavailable"
                style={{ ...Type.title, color: textSecondaryColor, fontVariant: ["tabular-nums"] }}
              >
                {"—"}
              </Text>
              <Text style={{ fontSize: 11, color: textSecondaryColor }}>
                {daysWithFood}/7 days logged
              </Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export default TodayWeekSummaryStats;
