import { ScrollView, StyleSheet, Text } from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * PlanMealFilterChipsV3 — Sloe v3 Plan meal-filter chip row (prototype
 * `plan-mealfilter` ~L4745-4749): All meals / Breakfast / Lunch / Dinner /
 * Snack. "All" shows the day-detail view; a specific slot switches the body to
 * the across-week list. Horizontally scrollable, edge-bleeding the host's
 * 20px padding. Behind sloe_v3_plan.
 */
export const PLAN_MEAL_FILTERS = [
  "All",
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
] as const;
export type PlanMealFilter = (typeof PLAN_MEAL_FILTERS)[number];

export interface PlanMealFilterChipsV3Props {
  selected: PlanMealFilter;
  onSelect: (filter: PlanMealFilter) => void;
}

export function PlanMealFilterChipsV3({
  selected,
  onSelect,
}: PlanMealFilterChipsV3Props) {
  const colors = useThemeColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {PLAN_MEAL_FILTERS.map((f) => {
        const active = f === selected;
        const label = f === "All" ? "All meals" : f;
        return (
          <PressableScale
            key={f}
            onPress={() => onSelect(f)}
            haptic="selection"
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            style={[
              styles.chip,
              {
                backgroundColor: active
                  ? colors.navPrimary
                  : colors.backgroundSecondary,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: active ? "#fff" : colors.text }]}>
              {label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginTop: Spacing.md, marginHorizontal: -Spacing.lg },
  row: { gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  chip: {
    paddingHorizontal: Spacing.dense,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  chipText: { ...Type.label, textTransform: "none", letterSpacing: 0, fontSize: 13 },
});

export default PlanMealFilterChipsV3;
