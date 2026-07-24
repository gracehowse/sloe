import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CircleCheck, Sparkles } from "lucide-react-native";
import { Accent, FontWeight, IconSize, MacroColors, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprNotice } from "@/components/ui/SupprNotice";
import { isFeatureEnabled } from "@/lib/analytics";
import {
  weeklyInsightCoachLine,
  weeklyInsightHeadline,
} from "@suppr/shared/copy/today";

/**
 * WeeklyInsightCard (mobile) — Sloe `TD3 · Weekly insight + Planned` re-skin
 * (Today re-skin unit 3, 2026-06-03). Figma 480:2 /
 * `docs/prototypes/stitch-sloe/today-insight.html` — the "This week" insight
 * card: a clay sparkle overline, a Newsreader headline, a 3-stat grid
 * (Days logged / Avg intake / On target), a 7-segment week bar, and a coach
 * line with a sage check.
 *
 * Re-skin only — wires the SAME data the host already holds for the selected
 * week. Every number is derived from log data:
 *   - days logged / avg intake — passed straight in (`loggedDaysInWeek`,
 *     `weekAvgKcal`).
 *   - on-target days — DERIVED here from `weekDailyKcal` vs `dailyKcalTarget`
 *     using the CANONICAL calorie band (±4%, min ±40 kcal) that
 *     `classifyDigestHeroTone` ("neutral") uses. This is a presentation
 *     count over data already on screen — NOT a new fetch and NOT a new
 *     threshold. No fabrication: `weekAvgKcal` is `null` when the week has
 *     no logged day so we never show "0 kcal" as a faux average, and the
 *     headline/coach copy degrades to honest calm lines.
 *
 * Gated behind `today-weekly-insight-mobile` (ENG-754 rollout flag,
 * preserved — the re-skin does NOT remove the existing gate). The flag
 * defaults to off (absent flag = false), so this card is invisible until
 * ramped.
 *
 * States covered:
 *  - Loaded week with at least one logged day: headline, 3-stat grid,
 *    7-segment week bar, optional coach line.
 *  - Empty week (no logs): calm "Your week starts here" headline + muted
 *    placeholder week bar + "Log a meal to start the week."
 *
 * Pinned by `tests/unit/weeklyInsightCardMobile.test.tsx`.
 */
export interface WeeklyInsightCardProps {
  /** Number of people this plan is cooking for (household member count
   *  + 1 for the user). 0 hides the planning line. */
  householdSize: number;
  /** Days in the selected week with at least one meal logged (0-7). */
  loggedDaysInWeek: number;
  /** Average daily kcal across the week. Null when no day is logged. */
  weekAvgKcal: number | null;
  /** Daily kcal totals for the week (length 7; 0 = no log marker). */
  weekDailyKcal: number[];
  /** Per-day kcal target — drives the on-target classification. */
  dailyKcalTarget: number;
  textColor: string;
  textSecondaryColor: string;
  cardBackgroundColor: string;
  borderColor: string;
}

/** Per-day state for the 7-segment week bar. */
export type WeekBarDayState = "onTarget" | "loggedOff" | "empty";

/**
 * Classify each of the 7 days for the week bar + the on-target count.
 * Reuses the CANONICAL calorie band (within ±4%, min ±40 kcal of target →
 * on target) that `classifyDigestHeroTone` returns "neutral" for — so the
 * "on target" definition can't drift from the rest of the product. A day
 * with no log (0 kcal) is `empty`; a logged day outside the band is
 * `loggedOff`. When no target is set every logged day is `loggedOff`
 * (we can't judge on-target without a target).
 */
export function computeWeekBarStates(
  weekDailyKcal: number[],
  dailyKcalTarget: number,
): WeekBarDayState[] {
  const tolerance =
    dailyKcalTarget > 0 ? Math.max(40, dailyKcalTarget * 0.04) : 0;
  return weekDailyKcal.slice(0, 7).map((kcal) => {
    if (!(kcal > 0)) return "empty";
    if (dailyKcalTarget > 0 && Math.abs(kcal - dailyKcalTarget) <= tolerance) {
      return "onTarget";
    }
    return "loggedOff";
  });
}

/** Count of on-target days in the week (derived; see `computeWeekBarStates`). */
export function computeDaysOnTarget(
  weekDailyKcal: number[],
  dailyKcalTarget: number,
): number {
  return computeWeekBarStates(weekDailyKcal, dailyKcalTarget).filter(
    (s) => s === "onTarget",
  ).length;
}

function Stat({
  value,
  label,
  textColor,
  textSecondaryColor,
  dividerColor,
}: {
  value: string;
  label: string;
  textColor: string;
  textSecondaryColor: string;
  dividerColor?: string;
}) {
  return (
    <View
      style={[
        styles.statCell,
        dividerColor
          ? { borderLeftWidth: 1, borderLeftColor: dividerColor }
          : null,
      ]}
    >
      <Text style={[styles.statValue, { color: textColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: textSecondaryColor }]}>{label}</Text>
    </View>
  );
}

function WeeklyInsightCardImpl({
  householdSize,
  loggedDaysInWeek,
  weekAvgKcal,
  weekDailyKcal,
  dailyKcalTarget,
  textColor,
  textSecondaryColor,
  cardBackgroundColor: _cardBackgroundColor,
  borderColor: _borderColor,
}: WeeklyInsightCardProps) {
  void _cardBackgroundColor;
  void _borderColor;
  const dayStates = React.useMemo(
    () => computeWeekBarStates(weekDailyKcal, dailyKcalTarget),
    [weekDailyKcal, dailyKcalTarget],
  );
  const onTargetDays = React.useMemo(
    () => dayStates.filter((s) => s === "onTarget").length,
    [dayStates],
  );

  // Secondary accent (Frost flag → damson, else clay) for the overline +
  // on-target week-bar pills. Read before the early return so the hook is
  // always called. Sage check + plum headline keep their own tokens.
  const accent = useAccent();
  // ENG-1010 (2026-06-10): scheme-resolved plum — static `MacroColors.calories`
  // measured 1.16–1.37:1 (near-invisible) on dark cards.
  const colors = useThemeColors();

  const figmaLayout = isFeatureEnabled("today_meals_figma_654");
  if (!isFeatureEnabled("today-weekly-insight-mobile") && !figmaLayout) return null;

  const headline = weeklyInsightHeadline(loggedDaysInWeek, onTargetDays);
  const coachLine = weeklyInsightCoachLine(loggedDaysInWeek, onTargetDays);

  const loggedLine =
    loggedDaysInWeek === 0
      ? "Log a meal to start the week."
      : loggedDaysInWeek === 1
        ? "1 day logged so far."
        : `${loggedDaysInWeek} days logged so far.`;

  const proseBody =
    coachLine ??
    (loggedDaysInWeek === 0
      ? loggedLine
      : weekAvgKcal != null
        ? `${loggedLine} ${Math.round(weekAvgKcal).toLocaleString()} kcal daily average.`
        : loggedLine);

  if (figmaLayout) {
    const figmaInsight = (
      <>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
          <Sparkles size={13} color={accent.primarySolid} strokeWidth={1.75} />
          <Text style={[styles.headerLabel, { color: accent.primarySolid }]}>
            WEEKLY INSIGHT
          </Text>
        </View>
        <Text style={[styles.figmaInsightBody, { color: textSecondaryColor }]}>
          {proseBody}
        </Text>
      </>
    );
    if (isFeatureEnabled("ui_anatomy_owners_v1")) {
      return (
        <SupprNotice
          tone="primary"
          variant="inline"
          testID="today-weekly-insight-mobile"
          accessibilityLabel="Weekly insight"
          style={{ marginBottom: Spacing.md }}
        >
          {figmaInsight}
        </SupprNotice>
      );
    }
    return (
      // Fresh-eyes §3 (2026-06-10): de-carded. On the inverted material the
      // lilac slab read as the odd muddy box between white gallery cards.
      // The insight is now a typographic callout sitting directly on the
      // cream ground — eyebrow + prose, content over chrome.
      <View
        testID="today-weekly-insight-mobile"
        accessibilityLabel="Weekly insight"
        style={{ paddingHorizontal: Spacing.xs, gap: Spacing.xs }}
      >
        {figmaInsight}
      </View>
    );
  }

  const legacyInsight = (
    <>
      {/* Accent sparkle overline (frame: `text-clay` sparkle + uppercase;
          flag-aware → damson under Frost). */}
      <View style={styles.headerRow}>
        {/* headers census 2026-06-10: sparkle-eyebrow row → IconSize.xs (was 15). */}
        <Sparkles size={IconSize.xs} color={accent.primarySolid} strokeWidth={1.75} />
        <Text style={[styles.headerLabel, { color: accent.primarySolid }]}>
          WEEKLY INSIGHT
        </Text>
      </View>

      {/* Newsreader headline — honest, derived from the real on-target ratio. */}
      <Text style={[styles.headline, { color: colors.navPrimary }]}>{headline}</Text>

      {householdSize > 0 ? (
        <Text style={[styles.planningLine, { color: textSecondaryColor }]}>
          {householdSize === 1
            ? "Planning for you this week"
            : `Planning for ${householdSize} this week`}
        </Text>
      ) : null}

      {/* 3-stat grid — Days logged / Avg intake / On target. Avg + on-target
          omit faux values: avg shows "—" when no day logged; on-target shows
          "—" when there's no target to judge against. */}
      <View style={styles.statGrid}>
        <Stat
          value={`${loggedDaysInWeek} / 7`}
          label="Days logged"
          textColor={textColor}
          textSecondaryColor={textSecondaryColor}
        />
        <Stat
          value={weekAvgKcal != null ? Math.round(weekAvgKcal).toLocaleString() : "—"}
          label="Avg intake"
          textColor={textColor}
          textSecondaryColor={textSecondaryColor}
          dividerColor={_borderColor}
        />
        <Stat
          value={
            dailyKcalTarget > 0 && loggedDaysInWeek > 0
              ? `${onTargetDays} day${onTargetDays === 1 ? "" : "s"}`
              : "—"
          }
          label="On target"
          textColor={textColor}
          textSecondaryColor={textSecondaryColor}
          dividerColor={_borderColor}
        />
      </View>

      {/* 7-segment week bar — one pill per day. On-target → accent; logged
          but off the band → faded accent; no log → line. Derived only from
          data already on screen. (Accent flag-aware → damson under Frost.) */}
      <View
        style={styles.weekBar}
        accessibilityRole="image"
        accessibilityLabel={
          loggedDaysInWeek === 0
            ? "No meals logged this week yet."
            : `${loggedDaysInWeek} days logged this week, ${onTargetDays} on target.`
        }
      >
        {dayStates.map((state, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 8,
              borderRadius: Radius.full,
              backgroundColor:
                state === "onTarget"
                  ? accent.primary
                  : state === "loggedOff"
                    ? `${accent.primary}66`
                    : _borderColor,
            }}
          />
        ))}
      </View>

      {/* Coach line (sage check) — only when honest + useful, else the
          plain logged-summary line so the card never reads empty. */}
      {coachLine ? (
        <View style={styles.coachRow}>
          <CircleCheck size={14} color={Accent.success} strokeWidth={2} />
          <Text style={[styles.coachLine, { color: textSecondaryColor }]}>{coachLine}</Text>
        </View>
      ) : (
        <Text style={[styles.summaryLine, { color: textSecondaryColor }]}>
          {loggedLine}
          {weekAvgKcal != null ? (
            <Text style={{ color: textColor, fontWeight: FontWeight.semibold }}>
              {" "}
              {Math.round(weekAvgKcal).toLocaleString()} kcal
            </Text>
          ) : null}
          {weekAvgKcal != null ? " daily average." : ""}
        </Text>
      )}
    </>
  );

  if (isFeatureEnabled("ui_anatomy_owners_v1")) {
    return (
      <SupprNotice
        tone="primary"
        variant="inline"
        testID="today-weekly-insight-mobile"
        accessibilityLabel="Weekly insight"
        style={{ marginBottom: Spacing.md }}
      >
        {legacyInsight}
      </SupprNotice>
    );
  }

  return (
    <View
      testID="today-weekly-insight-mobile"
      accessibilityLabel="Weekly insight"
      style={{ paddingHorizontal: Spacing.xs, gap: Spacing.xs }}
    >
      {legacyInsight}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    // headers census 2026-06-10: sparkle-eyebrow gap → Spacing.xs (was xs+2=6).
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  headerLabel: {
    ...Type.label,
  },
  headline: {
    ...Type.headline,
    marginBottom: Spacing.sm,
  },
  planningLine: {
    ...Type.caption,
    marginBottom: Spacing.md,
  },
  statGrid: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Spacing.xs,
    gap: Spacing.xs,
  },
  statValue: {
    ...Type.headline,
    fontVariant: ["tabular-nums"],
  },
  // headers census 2026-06-10: stat label → Type.label (kills the sub-ramp 9px).
  statLabel: {
    ...Type.label,
  },
  weekBar: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  coachRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  coachLine: {
    ...Type.caption,
    flex: 1,
  },
  summaryLine: {
    ...Type.caption,
  },
  figmaInsightBody: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export const WeeklyInsightCard = memo(WeeklyInsightCardImpl);

export default WeeklyInsightCard;
