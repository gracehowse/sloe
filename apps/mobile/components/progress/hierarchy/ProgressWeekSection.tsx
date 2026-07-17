import { Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { SupprCard } from "@/components/ui/SupprCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { HierarchyOverline } from "@/components/progress/hierarchy/HierarchyOverline";
import type { AdherenceMacroRow } from "@/components/progress/ProgressAverageAdherence";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useMacroColors } from "@/lib/macroColors";
import type { WeekDayTotals } from "@/lib/progressWeekReport";
import { formatMacroAdherenceBar } from "@suppr/nutrition-core/progressWeekReport";
import { formatAdherenceHeadline } from "@suppr/nutrition-core/adherenceDisplay";

/**
 * ENG-1525 §2 — This Week. A plain flat card that absorbs the legacy
 * Average Adherence card, the Daily Calories bars, and the on-target
 * ribbon into one section:
 *
 *  - DEMOTED adherence numeral (serif 28 — down from the legacy 40) with a
 *    reconciled headline: "82% avg · 5 of 7 days on target". Average
 *    adherence and the on-target count are DIFFERENT numbers — both are
 *    shown, never conflated. >110% flips to the shared overshoot reading
 *    ("11% over", amber — ENG-1296: over is amber, never red).
 *  - Mon–Sun calorie bars from the same `buildWeekStats().days` feed the
 *    legacy chart used: sage under / amber over / muted empty, today boxed
 *    (outline), a per-day target reference tick. Bars press through to the
 *    Today tab via `onDayPress`. Always pinned to the CURRENT week (the
 *    period control does not move this section).
 *  - Macro bars reusing the `formatMacroAdherenceBar` contract + the
 *    ProgressAverageAdherence row grammar (label · value · bar).
 *  - Streak microrow ("4-day streak · on-target 3 days running") — the
 *    press-through (`onOpenStreak`) keeps streak freezes reachable
 *    (delta 7).
 */
export interface ProgressWeekSectionProps {
  /** Range adherence %, already gated by the host's 3-day story floor
   *  (`hasEnoughDataForStory`) — null renders the building copy. */
  adherencePct: number | null;
  /** `buildWeekStats().days` — always the current week. */
  days: WeekDayTotals[];
  todayKey: string;
  /** False suppresses the "today" box emphasis (past weeks). Default true. */
  isCurrentWeek?: boolean;
  macros: AdherenceMacroRow[];
  streakDays: number;
  streakFreezesAvailable: number;
  /** Press-through to the existing streak surface (freezes live there). */
  onOpenStreak: () => void;
  onDayPress?: (dayKey: string) => void;
}

/** Trailing run of consecutive on-target days ending at the last logged day. */
export function trailingOnTargetRun(days: WeekDayTotals[]): number {
  let run = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i]!;
    if (d.calories === 0 && run === 0) continue; // skip unlogged tail (future days)
    if (d.calories > 0 && d.calories <= d.effectiveTargetCalories) run += 1;
    else break;
  }
  return run;
}

const CHART_HEIGHT = 96;
const BAR_MAX_FRAC = 0.72;

export function ProgressWeekSection({
  adherencePct,
  days,
  todayKey,
  isCurrentWeek = true,
  macros,
  streakDays,
  streakFreezesAvailable,
  onOpenStreak,
  onDayPress,
}: ProgressWeekSectionProps) {
  const colors = useThemeColors();
  const { colors: macro } = useMacroColors();

  const onTargetCount = days.filter(
    (d) => d.calories > 0 && d.calories <= d.effectiveTargetCalories,
  ).length;
  const overDisplay = adherencePct != null && adherencePct > 110 ? formatAdherenceHeadline(adherencePct) : null;
  const runningDays = trailingOnTargetRun(days);

  const maxCal = Math.max(...days.map((d) => Math.max(d.calories, d.effectiveTargetCalories)), 1);
  const scaleMax = maxCal * 1.15;
  const barMax = CHART_HEIGHT * BAR_MAX_FRAC;

  return (
    <SupprCard testID="progress-hierarchy-week" lift="soft" padding="lg">
      <HierarchyOverline testID="progress-hierarchy-week-overline">This week</HierarchyOverline>

      {/* Demoted numeral — serif 28 (ramp-legal), no longer competing with
          the §1 hero's 40. Headline reconciles avg adherence AND on-target
          count as two distinct figures. */}
      {adherencePct != null ? (
        <Text
          testID="progress-hierarchy-week-headline"
          style={{ ...Type.display, fontSize: 28, lineHeight: 32, color: overDisplay ? Accent.warningSolid : colors.text, fontVariant: ["tabular-nums"] }}
        >
          {overDisplay ? `${overDisplay.value}${overDisplay.suffix}` : `${adherencePct}%`}
          <Text style={{ ...Type.bodyLarge, color: colors.textSecondary }}>
            {" "}avg · {onTargetCount} of {days.length} days on target
          </Text>
        </Text>
      ) : (
        <Text
          testID="progress-hierarchy-week-building"
          style={{ ...Type.body, color: colors.textSecondary }}
        >
          {onTargetCount > 0
            ? `${onTargetCount} of ${days.length} days on target — log a few more days for your weekly average.`
            : "Log a few more days for your weekly average."}
        </Text>
      )}

      {/* Mon–Sun calorie bars — same per-day feed + colour law as the legacy
          Daily Calories chart (effective targets, ENG-787). */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: Spacing.sm, height: CHART_HEIGHT, marginTop: Spacing.md }}>
        {days.map((d) => {
          const overTarget = d.calories > d.effectiveTargetCalories;
          const barH = Math.max(4, (d.calories / scaleMax) * barMax);
          const targetY = d.effectiveTargetCalories > 0
            ? Math.min((d.effectiveTargetCalories / scaleMax) * barMax, CHART_HEIGHT - 16)
            : null;
          const isDayToday = isCurrentWeek && d.key === todayKey;
          return (
            <PressableScale
              key={d.key}
              haptic="selection"
              disabled={!onDayPress}
              onPress={() => onDayPress?.(d.key)}
              accessibilityRole="button"
              accessibilityLabel={`${d.label}: ${d.calories} of ${d.effectiveTargetCalories} calories`}
              style={{
                flex: 1,
                height: CHART_HEIGHT,
                justifyContent: "flex-end",
                alignItems: "center",
                borderRadius: Radius.md,
                borderWidth: isDayToday ? 1 : 0,
                borderColor: colors.borderStrong,
              }}
            >
              {/* Per-day target reference tick. */}
              {targetY != null ? (
                <View
                  style={{
                    position: "absolute",
                    bottom: targetY + 14,
                    width: "70%",
                    height: 2,
                    borderRadius: Radius.full,
                    backgroundColor: macro.carbs,
                  }}
                />
              ) : null}
              <View
                testID={`progress-hierarchy-day-bar-${d.key}`}
                style={{
                  width: "70%",
                  height: barH,
                  borderRadius: Radius.md,
                  // NEVER red: sage on/under, amber over, muted empty.
                  backgroundColor: d.calories === 0 ? colors.border : overTarget ? Accent.warning : Accent.success,
                }}
              />
              <Text style={{ ...Type.caption, fontSize: 10, fontWeight: isDayToday ? "700" : "500", color: isDayToday ? colors.text : colors.textTertiary, marginTop: Spacing.xs }}>
                {d.label.charAt(0)}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {/* Macro adherence rows — the ProgressAverageAdherence grammar. */}
      <View style={{ marginTop: Spacing.lg, gap: Spacing.md }}>
        {macros.map(({ name, pct, color }) => {
          const bar = formatMacroAdherenceBar({ adherencePct: pct });
          const tone = bar.isOver ? Accent.warning : color;
          return (
            <View key={name} testID={`progress-hierarchy-macro-${name.toLowerCase()}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Text style={{ ...Type.captionStrong, fontWeight: "400", color: colors.text }}>{name}</Text>
                <Text style={{ ...Type.captionStrong, color: colors.text, fontVariant: ["tabular-nums"] }}>
                  {bar.label}
                  {bar.isOver ? <Text style={{ color: colors.textSecondary, fontWeight: "400" }}> · over</Text> : null}
                </Text>
              </View>
              <View style={{ marginTop: Spacing.sm, height: 6, borderRadius: Radius.full, backgroundColor: colors.inputBg, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${bar.barFillPct}%`, borderRadius: Radius.full, backgroundColor: tone }} />
              </View>
            </View>
          );
        })}
      </View>

      {/* Streak microrow — texture, not a stat block. Press-through keeps
          freezes reachable (delta 7). Suppressed entirely when there is
          nothing to say (no empty achievements, ENG-1006). */}
      {streakDays > 0 || streakFreezesAvailable > 0 ? (
        <PressableScale
          haptic="selection"
          onPress={onOpenStreak}
          accessibilityRole="button"
          accessibilityLabel="Open streak details"
          testID="progress-hierarchy-streak-row"
          style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.md, alignSelf: "flex-start" }}
          hitSlop={6}
        >
          <Text style={{ ...Type.captionSmall, color: colors.textSecondary }}>
            {streakDays > 0 ? `${streakDays}-day streak` : "Streak paused"}
            {runningDays > 1 ? ` · on-target ${runningDays} days running` : ""}
            {streakFreezesAvailable > 0
              ? ` · ${streakFreezesAvailable} freeze${streakFreezesAvailable === 1 ? "" : "s"} banked`
              : ""}
          </Text>
          <ChevronRight size={12} color={colors.textTertiary} strokeWidth={1.75} />
        </PressableScale>
      ) : null}
    </SupprCard>
  );
}

export default ProgressWeekSection;
