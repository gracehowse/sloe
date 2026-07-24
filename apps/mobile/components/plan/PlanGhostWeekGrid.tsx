import { StyleSheet, Text, View } from "react-native";

import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * PlanGhostWeekGrid — the ghosted week under `PlanEmptyWeekCard`.
 *
 * Design-consistency pass (2026-07-24). The empty Plan used to be one
 * invitation card over dead space: nothing showed what "Generate this week"
 * actually produces, so the promise was abstract. This draws the shape of it —
 * the REAL seven dates of the week the generator will fill, each with one
 * quiet pill per meal slot.
 *
 * Deliberately non-interactive (no `PressableScale`, and that is correct, not
 * a missing state): tapping a ghost would promise a per-slot add flow the
 * empty state has explicitly deferred to "or add meals as you go", which
 * mounts the real, tappable dashed `PlanEmptySlotV3` rows. It speaks to
 * assistive tech as ONE image with a sentence label — 28 individually
 * announced ghost pills would be noise.
 *
 * Behind `design_consistency_v1`, gated by the host (`PlanV3Surface`) together
 * with the empty-week predicate; this component carries no flag logic.
 *
 * Web twin: `src/app/components/suppr/plan-empty-week-grid.tsx`
 * (`PlanGhostWeekGrid`) — a row per day at phone width, a seven-column grid at
 * `lg` where the desktop void it exists to fill actually is.
 */
const GHOST_WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface PlanGhostWeekGridProps {
  /** The REAL week the generator will fill — labels derive from these dates,
   *  never from an invented Mon–Sun. */
  weekDates: Date[];
  /** The slots the generator will fill, in order (the plan's own slot count,
   *  sliced from `ALL_MEAL_SLOTS` — not a hard-coded three). */
  slots: readonly string[];
}

export function PlanGhostWeekGrid({ weekDates, slots }: PlanGhostWeekGridProps) {
  const colors = useThemeColors();
  if (weekDates.length === 0 || slots.length === 0) return null;
  const slotWords = slots.map((s) => s.toLowerCase()).join(", ");
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Preview of a generated week: ${weekDates.length} days, each with ${slotWords}.`}
      testID="plan-ghost-week-grid"
      style={styles.grid}
    >
      {weekDates.map((date, i) => (
        <View key={i} style={[styles.day, { borderColor: colors.border }]}>
          <Text style={[styles.dayLabel, { color: colors.textTertiary }]}>
            {GHOST_WEEKDAY[date.getDay()]}
          </Text>
          <View style={styles.slots}>
            {slots.map((slot) => (
              <View
                key={slot}
                style={[styles.slot, { backgroundColor: colors.backgroundSecondary }]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.slotLabel, { color: colors.textTertiary }]}
                >
                  {slot}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { marginTop: Spacing.md, gap: Spacing.sm },
  day: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.dense,
    borderRadius: Radius.xl,
    // 1px, not hairline: iOS renders a dash pattern scaled to the border width,
    // so a 0.33pt dashed border collapses into a faint solid line. Matches the
    // nearest sibling (`PlanEmptySlotV3`'s dashed row) and the web twin's
    // `border border-dashed`.
    borderWidth: 1,
    borderStyle: "dashed",
    padding: Spacing.dense,
  },
  // 11/600 tracked caps in tertiary — the same quiet day-label idiom
  // `PlanEmptySlotV3` uses for its slot name, not the page-chrome eyebrow
  // (this is a preview label, not a section kicker).
  // 40 = the on-scale label gutter (web twin: `w-10`), so the seven rows'
  // pills line up into an actual grid rather than ragging off the day name.
  dayLabel: { ...Type.statLabel, width: Spacing.xxxl },
  slots: { flexDirection: "row", flex: 1, minWidth: 0, gap: Spacing.sm },
  slot: {
    flex: 1,
    minWidth: 0,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    alignItems: "center",
  },
  slotLabel: { ...Type.caption },
});

export default PlanGhostWeekGrid;
