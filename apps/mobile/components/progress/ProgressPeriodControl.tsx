import { StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { PressableScale } from "@/components/ui/PressableScale";
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
 *   1. A §8 segmented control: D / W / M / 6M / Y on the `inputBg` rail
 *      (Radius.full, padding 2), active segment = elevated card inside the
 *      track with the aubergine `primarySolid` label. Identical treatment to
 *      `WeightRangeToggle` / the macro-detail toggle (chips census 2026-06-10).
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
  const accent = useAccent();

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
      {/* 1. SEGMENTED CONTROL — §8 treatment (rail = inputBg, pill = card). */}
      <View
        testID="progress-period-segments"
        accessibilityRole="tablist"
        style={[styles.track, { backgroundColor: colors.inputBg }]}
      >
        {PERIOD_TYPES.map((type) => {
          const active = type === period.type;
          return (
            <PressableScale
              key={type}
              haptic="selection"
              testID={`progress-period-segment-${type}`}
              accessibilityRole="tab"
              accessibilityLabel={periodTypeAccessibilityLabel(type)}
              accessibilityState={{ selected: active }}
              onPress={() => selectType(type)}
              style={[
                styles.segment,
                active && {
                  backgroundColor: colors.card,
                  shadowColor: "#000",
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  { color: active ? accent.primarySolid : colors.textSecondary },
                  active && { fontWeight: "600" },
                ]}
              >
                {type}
              </Text>
            </PressableScale>
          );
        })}
      </View>

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
  track: {
    flexDirection: "row",
    borderRadius: Radius.full,
    padding: 2, // §8 track padding (chips census 2026-06-10)
    alignSelf: "stretch",
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
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
