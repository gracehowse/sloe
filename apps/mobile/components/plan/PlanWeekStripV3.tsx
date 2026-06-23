import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { PlanDayStatus } from "@suppr/shared/planning/planWeekStatus";

/**
 * PlanWeekStripV3 — Sloe v3 Plan week strip / day selector.
 *
 * Parity with the prototype (`docs/ux/redesign/v3/Sloe-App.html` Plan `pweek`
 * ~L4725-4734): a 7-cell row, each cell = day letter + date numeral + a 3-state
 * status ring (full = sage / part = amber / empty = hollow outline) folded into
 * navigation. The selected day fills plum with white text + a white ring; today
 * (when not selected) tints its letter the brand accent.
 *
 * Presentational — the host derives each day's status from the real week plan
 * (`computePlanDayStatus`) and owns the selected-day state. Behind sloe_v3_plan.
 */
export interface PlanWeekStripDay {
  /** Stable key (e.g. the day's ISO date or index). */
  key: string;
  /** Single-letter weekday, e.g. "M". */
  dayLetter: string;
  /** Date numeral, e.g. 16. */
  dateNum: number;
  status: PlanDayStatus;
  isToday: boolean;
}

export interface PlanWeekStripV3Props {
  days: PlanWeekStripDay[];
  selectedKey: string;
  onSelectDay: (key: string) => void;
}

export function PlanWeekStripV3({
  days,
  selectedKey,
  onSelectDay,
}: PlanWeekStripV3Props) {
  const colors = useThemeColors();
  return (
    <View style={styles.strip} accessibilityRole="tablist">
      {days.map((d) => {
        const selected = d.key === selectedKey;
        const ringColor =
          d.status === "full"
            ? Accent.success
            : d.status === "part"
              ? Accent.warning
              : "transparent";
        const isHollow = d.status === "empty";
        return (
          <PressableScale
            key={d.key}
            onPress={() => onSelectDay(d.key)}
            haptic="selection"
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${d.dayLetter} ${d.dateNum}`}
            style={[styles.cell, selected && { backgroundColor: colors.navPrimary }]}
          >
            <Text
              style={[
                styles.letter,
                {
                  color: selected
                    ? "#fff"
                    : d.isToday
                      ? colors.navPrimary
                      : colors.textTertiary,
                },
              ]}
            >
              {d.dayLetter}
            </Text>
            <Text style={[styles.date, { color: selected ? "#fff" : colors.text }]}>
              {d.dateNum}
            </Text>
            <View
              style={[
                styles.ring,
                {
                  backgroundColor: selected
                    ? "#fff"
                    : isHollow
                      ? "transparent"
                      : ringColor,
                  borderWidth: isHollow && !selected ? 1 : 0,
                  borderColor: colors.borderStrong,
                },
              ]}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", gap: 6, marginTop: Spacing.md },
  cell: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: "transparent",
  },
  letter: { ...Type.statLabel, fontSize: 11 },
  date: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  ring: { width: 7, height: 7, borderRadius: Radius.full },
});

export default PlanWeekStripV3;
