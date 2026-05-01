import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Accent } from "@/constants/theme";
import { formatPlannedMealKcalMacrosLine } from "../../../../src/lib/nutrition/plannedMealDisplay";
import { PortionPickerSheet } from "./PortionPickerSheet";

/**
 * TodayPlannedMealsCard — "Planned" list on the Today screen when the
 * user has a meal plan row for the day.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). 2026-04-30: replaced system `Alert.alert` portion picker
 * with the in-app `PortionPickerSheet` (customer-lens audit — system
 * iOS alerts mid-flow read as prototype-tier).
 */
export type TodayPlannedMealEntry = {
  name?: string;
  recipe_title?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  /** Lets the Today log path pull fiber/sugar/sodium from the saved recipe. */
  recipe_id?: string | null;
};

export interface TodayPlannedMealsCardProps {
  plannedMeals: TodayPlannedMealEntry[];
  onLogPlannedMealWithPortion: (pm: TodayPlannedMealEntry, portion: number) => void;
  styles: Record<string, any>;
}

export function TodayPlannedMealsCard({
  plannedMeals,
  onLogPlannedMealWithPortion,
  styles,
}: TodayPlannedMealsCardProps) {
  const [picker, setPicker] = useState<{ meal: TodayPlannedMealEntry } | null>(null);

  return (
    <View style={styles.card}>
      <View style={styles.mealSlotHeader}>
        <Text style={[styles.mealSlotName, { color: Accent.primary }]}>Planned</Text>
      </View>
      {plannedMeals.map((pm, i) => (
        <View key={`planned-${i}`} style={styles.mealRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.mealName, { opacity: 0.7 }]}>{pm.recipe_title ?? pm.name}</Text>
            <Text style={styles.mealMeta}>
              {formatPlannedMealKcalMacrosLine(
                Number(pm.calories) || 0,
                Number(pm.protein) || 0,
                Number(pm.carbs) || 0,
                Number(pm.fat) || 0,
              )}
            </Text>
          </View>
          <Pressable
            onPress={() => setPicker({ meal: pm })}
            accessibilityRole="button"
            accessibilityLabel={`Log ${pm.recipe_title ?? pm.name ?? "planned meal"} today`}
            style={{ paddingHorizontal: 8, paddingVertical: 12 }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.primary }}>Log today</Text>
          </Pressable>
        </View>
      ))}
      <PortionPickerSheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        mealName={picker?.meal.recipe_title ?? picker?.meal.name ?? ""}
        onPick={(portion) => {
          if (picker) onLogPlannedMealWithPortion(picker.meal, portion);
        }}
      />
    </View>
  );
}

export default TodayPlannedMealsCard;
