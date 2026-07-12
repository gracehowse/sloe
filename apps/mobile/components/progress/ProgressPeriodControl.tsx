import { StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { PressableScale } from "@/components/ui/PressableScale";
import { SegmentedTrack } from "@/components/ui/SegmentedTrack";
import {
  PERIOD_TYPES,
  isCurrentPeriod,
  nextPeriod,
  periodLabel,
  periodTypeAccessibilityLabel,
  previousPeriod,
  withPeriodType,
  type ProgressPeriod,
  type PeriodType,
  type WeekStartDay,
} from "@suppr/nutrition-core/progressPeriod";

/**
 * ProgressPeriodControl — Apple Health range grammar (ENG-1030).
 *
 * Two stacked rows:
 *   1. A §8 segmented control: D / W / M / 6M / Y rendered by the canonical
 *      `SegmentedTrack` primitive (ENG-1375 — inputBg rail, card-white thumb,
 *      `primarySolid` semibold active label).
 *   2. A period-paging row: ‹ label › — the period label (e.g. "15–21 Jun")
 *      flanked by chevron buttons. The forward chevron is disabled (and dimmed)
 *      on the current period (no future). The chevrons are the paging
 *      affordance and the accessible path; a horizontal chart swipe is a
 *      tracked enhancement (ENG-1031) — chevrons are deliberately the only
 *      wired path today, never a gap (design-system rule: swipe must never be
 *      the ONLY path, so chevrons-first is correct).
 *
 * Every selection/page fires `selection` haptic via `PressableScale`.
 *
 * Mirror: `src/app/components/suppr/progress-period-control.tsx`.
 */

export interface ProgressPeriodControlProps {
  period: ProgressPeriod;
  weekStart: WeekStartDay;
  onChange: (next: ProgressPeriod) => void;
  /** Injected for deterministic labels in tests; defaults to real clock. */
  now?: Date;
}

export function ProgressPeriodControl({
  period,
  weekStart,
  onChange,
  now,
}: ProgressPeriodControlProps) {
  const colors = useThemeColors();

  const atCurrent = isCurrentPeriod(period);
  const label = periodLabel(period, weekStart, now);

  const selectType = (type: PeriodType) => {
    if (type === period.type) return;
    onChange(withPeriodType(period, type));
  };

  const goPrev = () => {
    onChange(previousPeriod(period));
  };

  const goNext = () => {
    if (atCurrent) return;
    onChange(nextPeriod(period));
  };

  return (
    <View style={{ gap: Spacing.dense }}>
      {/* 1. SEGMENTED CONTROL — the canonical §8 SegmentedTrack (ENG-1375 S3;
          this file was one of the two conforming references the primitive was
          extracted from). */}
      <SegmentedTrack
        role="tablist"
        testID="progress-period-segments"
        accessibilityLabel="Progress time range"
        options={PERIOD_TYPES.map((type) => ({
          value: type,
          label: type,
          accessibilityLabel: periodTypeAccessibilityLabel(type),
          testID: `progress-period-segment-${type}`,
        }))}
        value={period.type}
        onChange={selectType}
      />

      {/* 2. PERIOD PAGING — ‹ label › */}
      <View testID="progress-period-pager" style={styles.pager}>
        <PressableScale
          haptic="selection"
          testID="progress-period-prev"
          accessibilityRole="button"
          accessibilityLabel="Previous period"
          onPress={goPrev}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          style={styles.chevronBtn}
        >
          <ChevronLeft size={20} color={colors.textSecondary} strokeWidth={2} />
        </PressableScale>

        <Text
          testID="progress-period-label"
          accessibilityRole="header"
          style={[styles.label, { color: colors.text }]}
        >
          {label}
        </Text>

        <PressableScale
          haptic={atCurrent ? "none" : "selection"}
          testID="progress-period-next"
          accessibilityRole="button"
          accessibilityLabel="Next period"
          accessibilityState={{ disabled: atCurrent }}
          disabled={atCurrent}
          onPress={goNext}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          style={[styles.chevronBtn, atCurrent && { opacity: 0.3 }]}
        >
          <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  chevronBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...Type.body,
    fontFamily: Type.bodyLarge.fontFamily,
    fontSize: Type.bodyLarge.fontSize,
    lineHeight: Type.bodyLarge.lineHeight,
    fontWeight: "600",
    minWidth: 160,
    textAlign: "center",
  },
});
