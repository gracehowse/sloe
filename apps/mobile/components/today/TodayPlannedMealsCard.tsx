import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Accent } from "@/constants/theme";
import { formatPlannedMealKcalMacrosLine } from "../../../../src/lib/nutrition/plannedMealDisplay";

/**
 * TodayPlannedMealsCard — "Planned" list on the Today screen when the
 * user has a meal plan row for the day.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18).
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
            onPress={() => {
              Alert.alert("Log planned meal", "Pick portion vs the planned serving.", [
                { text: "Cancel", style: "cancel" },
                { text: "½×", onPress: () => onLogPlannedMealWithPortion(pm, 0.5) },
                { text: "1×", onPress: () => onLogPlannedMealWithPortion(pm, 1) },
                { text: "1½×", onPress: () => onLogPlannedMealWithPortion(pm, 1.5) },
                { text: "2×", onPress: () => onLogPlannedMealWithPortion(pm, 2) },
              ]);
            }}
            style={{ paddingHorizontal: 8, paddingVertical: 12 }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.primary }}>Log today</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export default TodayPlannedMealsCard;
