import { ScrollView, StyleSheet } from "react-native";

import { FilterChip } from "@/components/ui/FilterChip";
import { Spacing } from "@/constants/theme";

/**
 * PlanMealFilterChipsV3 — Sloe v3 Plan meal-filter chip row (prototype
 * `plan-mealfilter` ~L4745-4749): All meals / Breakfast / Lunch / Dinner /
 * Snack. "All" shows the day-detail view; a specific slot switches the body to
 * the across-week list. Horizontally scrollable, edge-bleeding the host's
 * 20px padding. Behind sloe_v3_plan.
 *
 * Chip ruling 2026-07-10 (ENG-1375 S1,
 * `docs/decisions/2026-07-10-chip-grammar-soft-tint.md`): selection is the
 * shared §7 FilterChip soft tint — the previous solid plum fill is reserved
 * for DAY CELLS in the week strip, not filter chips.
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
          <FilterChip
            key={f}
            label={label}
            selected={active}
            onPress={() => onSelect(f)}
            size="md"
            accessibilityLabel={label}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginTop: Spacing.md, marginHorizontal: -Spacing.lg },
  row: { gap: Spacing.sm, paddingHorizontal: Spacing.lg },
});

export default PlanMealFilterChipsV3;
