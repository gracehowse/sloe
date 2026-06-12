/**
 * Dev fixture — Today edit-meal modal with Time eaten visible (ENG-772).
 *
 * Renders the real `TodayEditMealModal` with `editEatenAtEnabled={true}` so
 * Maestro / ios-simulator MCP can assert the consumption-time field without
 * forcing PostHog flags or long-pressing a logged meal row.
 *
 * Reachable only via deeplink `suppr:///dev/edit-meal-states` (__DEV__ builds).
 */
import * as React from "react";
import { View, Text } from "react-native";
import { Stack } from "expo-router";

import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { TodayEditMealModal } from "@/components/today/TodayEditMealModal";
import type { JournalMeal } from "@/lib/nutritionJournal";

const MOCK_MEAL: JournalMeal = {
  id: "dev-fixture-meal-1",
  name: "Agent fixture — Greek salad",
  recipeTitle: "Greek salad",
  time: "12:30",
  calories: 420,
  protein: 18,
  carbs: 32,
  fat: 22,
  eatenAt: new Date().toISOString(),
};

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

export default function EditMealStatesScreen() {
  const colors = useThemeColors();
  const [editSlot, setEditSlot] = React.useState("Lunch");
  const [editPortion, setEditPortion] = React.useState("1");
  const [editTitle, setEditTitle] = React.useState(MOCK_MEAL.name);
  const [editKcal, setEditKcal] = React.useState(String(MOCK_MEAL.calories));
  const [editProtein, setEditProtein] = React.useState(String(MOCK_MEAL.protein));
  const [editCarbs, setEditCarbs] = React.useState(String(MOCK_MEAL.carbs));
  const [editFat, setEditFat] = React.useState(String(MOCK_MEAL.fat));
  const [editEatenAtTime, setEditEatenAtTime] = React.useState("12:30");

  return (
    <>
      <Stack.Screen options={{ title: "Edit meal fixture" }} />
      <View
        testID="screen-edit-meal-fixture"
        style={{ flex: 1, backgroundColor: colors.background, padding: Spacing.lg }}
      >
        <Text style={{ ...Type.body, color: colors.textSecondary, marginBottom: Spacing.md }}>
          ENG-772 fixture — edit modal with Time eaten field forced on.
        </Text>
        <TodayEditMealModal
          enabled
          editEatenAtEnabled
          editEatenAtTime={editEatenAtTime}
          onEditEatenAtTimeChange={setEditEatenAtTime}
          editingMeal={MOCK_MEAL}
          slots={SLOTS}
          editSlot={editSlot}
          onEditSlotChange={setEditSlot}
          editPortion={editPortion}
          onEditPortionChange={setEditPortion}
          onApplyPortionMultiplier={() => {}}
          editTitle={editTitle}
          onEditTitleChange={setEditTitle}
          editKcal={editKcal}
          onEditKcalChange={setEditKcal}
          editProtein={editProtein}
          onEditProteinChange={setEditProtein}
          editCarbs={editCarbs}
          onEditCarbsChange={setEditCarbs}
          editFat={editFat}
          onEditFatChange={setEditFat}
          onSave={() => {}}
          onDelete={() => {}}
          onClose={() => {}}
          styles={{}}
          cardColor={colors.card}
          borderColor={colors.border}
          inputBgColor={colors.inputBg}
          textColor={colors.text}
          textSecondaryColor={colors.textSecondary}
          textTertiaryColor={colors.textTertiary}
        />
      </View>
    </>
  );
}
