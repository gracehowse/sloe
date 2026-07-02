import { StyleSheet, Text, View } from "react-native";

import type { PlanJournalByDay } from "@suppr/shared/planning/planCookedMeals";
import {
  isPlanMealCooked,
  journalEntriesForPlanDate,
} from "@suppr/shared/planning/planCookedMeals";
import { ALL_MEAL_SLOTS } from "@/lib/mealPlanAlgo";
import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { DayPlan } from "@/lib/types";
import { PlanMealCardV3 } from "./PlanMealCardV3";
import { PlanEmptySlotV3 } from "./PlanEmptySlotV3";
import type { PlanMealFilter } from "./PlanMealFilterChipsV3";

const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Map a meal-filter chip to its `ALL_MEAL_SLOTS` index ("Snack" → "Snacks"). */
function filterSlotIndex(filter: Exclude<PlanMealFilter, "All">): number {
  const slot = filter === "Snack" ? "Snacks" : filter;
  const i = ALL_MEAL_SLOTS.indexOf(slot);
  return i >= 0 ? i : 0;
}

/**
 * PlanMealSectionV3 — Sloe v3 Plan meal body (ENG-1225 Block 3). With the "All"
 * filter it lists the selected day's four slots (prototype `plan-card` /
 * `plan-empty`); with a specific slot filter it switches to the across-week view
 * — that slot for every day Mon–Sun, each under a day header (prototype
 * `plan-mealfilter` ~L4745). Behind sloe_v3_plan.
 */
export interface PlanMealSectionV3Props {
  plan: DayPlan[] | null;
  /** Index of the day the strip has selected (used for the "All" view). */
  selectedDayIndex: number;
  /** One Date per plan day (across-week day headers). */
  weekDates: Date[];
  filter: PlanMealFilter;
  onOpenMeal: (dayIndex: number, slotIndex: number) => void;
  onAddToSlot: (dayIndex: number, slotIndex: number) => void;
  /** ENG-1238 — per-meal action sheet (⋯ on populated cards). */
  onOpenMealOptions?: (dayIndex: number, slotIndex: number) => void;
  nutritionByDay?: PlanJournalByDay;
}

export function PlanMealSectionV3({
  plan,
  selectedDayIndex,
  weekDates,
  filter,
  onOpenMeal,
  onAddToSlot,
  onOpenMealOptions,
  nutritionByDay,
}: PlanMealSectionV3Props) {
  const colors = useThemeColors();

  const renderSlot = (dayIndex: number, slotIndex: number, slotLabel: string) => {
    const meal = plan?.[dayIndex]?.meals[slotIndex];
    const date = weekDates[dayIndex];
    const logged = date ? journalEntriesForPlanDate(nutritionByDay, date) : [];
    if (meal && !meal.isPlaceholder) {
      const cooked = isPlanMealCooked(
        {
          recipeId: meal.recipeId,
          recipeTitle: meal.recipeTitle || meal.name,
          isPlaceholder: meal.isPlaceholder,
        },
        logged,
      );
      return (
        <PlanMealCardV3
          slot={slotLabel}
          name={meal.recipeTitle || meal.name}
          kcal={Math.round(meal.calories)}
          isLocked={meal.isLocked}
          isCooked={cooked}
          onPress={() => onOpenMeal(dayIndex, slotIndex)}
          onOpenOptions={
            onOpenMealOptions
              ? () => onOpenMealOptions(dayIndex, slotIndex)
              : undefined
          }
        />
      );
    }
    return (
      <PlanEmptySlotV3
        slot={slotLabel}
        onPress={() => onAddToSlot(dayIndex, slotIndex)}
      />
    );
  };

  if (filter === "All") {
    return (
      <View style={styles.body}>
        {ALL_MEAL_SLOTS.map((slot, j) => (
          <View key={slot}>{renderSlot(selectedDayIndex, j, slot)}</View>
        ))}
      </View>
    );
  }

  const slotIndex = filterSlotIndex(filter);
  return (
    <View style={styles.body}>
      {weekDates.map((date, i) => (
        <View key={i} style={styles.weekRow}>
          <Text style={[styles.dayHeader, { color: colors.textTertiary }]}>
            {WEEKDAY_LONG[date.getDay()] ?? "Day"} {date.getDate()}
          </Text>
          {renderSlot(i, slotIndex, filter)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: Spacing.xs },
  weekRow: { marginTop: Spacing.md },
  dayHeader: { ...Type.statLabel, fontSize: 11 },
});

export default PlanMealSectionV3;
