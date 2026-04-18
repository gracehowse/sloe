import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Accent, MacroColors, Radius, Spacing } from "@/constants/theme";
import type { JournalMeal } from "@/lib/nutritionJournal";

/**
 * TodayMealsSection — per-slot meal list with swipe-to-delete, long-press
 * menu, save-combo chip, and "Duplicate day" chip.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). All state stays in the host so the journal write path
 * + analytics firing points remain untouched.
 */

export interface TodayMealsSectionProps {
  slots: readonly string[];
  mealGroups: Record<string, JournalMeal[]>;
  mealsTodayCount: number;
  collapsedSlots: Set<string>;
  onToggleSlotCollapse: (slot: string) => void;
  onOpenFabForSlot: (slot: string) => void;
  onOpenSaveMealSheetForSlot: (slot: string) => void;
  onOpenDuplicateDay: () => void;
  onPressMeal: (mealId: string) => void;
  onLongPressEdit: (meal: JournalMeal) => void;
  onRequestCopyMeal: (mealId: string) => void;
  onDeleteMeal: (mealId: string) => void;
  showMealTimestamps: boolean;
  formatMealMacroDetail: (m: JournalMeal) => string;
  formatMealTimeDisplay: (time: string | undefined, createdAt?: string | null) => string;
  formatMealSourceLabelForRow: (source: string | null | undefined) => string | null;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  cardColor: string;
  cardBorderColor: string;
}

const SLOT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Breakfast: "cafe-outline",
  Lunch: "sunny-outline",
  Dinner: "restaurant-outline",
  Snacks: "cafe-outline",
  Snack: "cafe-outline",
};

const SLOT_COLOR: Record<string, string> = {
  Breakfast: Accent.warning,
  Lunch: Accent.success,
  Dinner: Accent.primary,
  Snacks: MacroColors.fat,
  Snack: MacroColors.fat,
};

function slotIcon(s: string): keyof typeof Ionicons.glyphMap {
  return SLOT_ICON[s] ?? ("restaurant-outline" as keyof typeof Ionicons.glyphMap);
}

function slotColor(s: string): string {
  return SLOT_COLOR[s] ?? Accent.primary;
}

export function TodayMealsSection(props: TodayMealsSectionProps) {
  const {
    slots,
    mealGroups,
    mealsTodayCount,
    collapsedSlots,
    onToggleSlotCollapse,
    onOpenFabForSlot,
    onOpenSaveMealSheetForSlot,
    onOpenDuplicateDay,
    onPressMeal,
    onLongPressEdit,
    onRequestCopyMeal,
    onDeleteMeal,
    showMealTimestamps,
    formatMealMacroDetail,
    formatMealTimeDisplay,
    formatMealSourceLabelForRow,
    textColor,
    textTertiaryColor,
    textSecondaryColor,
    cardColor,
    cardBorderColor,
  } = props;

  return (
    <View>
      {mealsTodayCount > 0 && (
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 6 }}>
          <Pressable
            onPress={onOpenDuplicateDay}
            accessibilityRole="button"
            accessibilityLabel="Duplicate this day to another day"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: Accent.primary + "12",
            }}
          >
            <Ionicons name="copy-outline" size={12} color={Accent.primary} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: Accent.primary }}>Duplicate day…</Text>
          </Pressable>
        </View>
      )}
      <View
        style={{
          backgroundColor: cardColor,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: cardBorderColor,
          overflow: "hidden",
          marginBottom: Spacing.lg,
        }}
      >
        {slots.map((slot) => {
          const meals = mealGroups[slot] ?? [];
          const slotCals = Math.round(meals.reduce((a, m) => a + m.calories, 0));
          const isOpen = !collapsedSlots.has(slot);
          const hasMeals = meals.length > 0;
          const ic = slotIcon(slot);
          const col = slotColor(slot);
          return (
            <View key={slot}>
              <Pressable
                onPress={() => (hasMeals ? onToggleSlotCollapse(slot) : onOpenFabForSlot(slot))}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: cardBorderColor,
                  opacity: hasMeals ? 1 : 0.45,
                  padding: 12,
                  paddingHorizontal: 14,
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    backgroundColor: col + "18",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={ic} size={16} color={col} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: textColor }}>{slot}</Text>
                  {hasMeals ? (
                    <Text style={{ fontSize: 11, color: textTertiaryColor }}>
                      {meals.length} item{meals.length > 1 ? "s" : ""} · tap a meal for full nutrition
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 11, color: textTertiaryColor }}>Tap to add</Text>
                  )}
                </View>
                {hasMeals ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {meals.length >= 2 && (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          onOpenSaveMealSheetForSlot(slot);
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Save ${slot} items as a meal combo`}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: cardBorderColor,
                          backgroundColor: "transparent",
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "600", color: textSecondaryColor }}>Save combo</Text>
                      </Pressable>
                    )}
                    <Text style={{ fontSize: 14, fontWeight: "700", color: textColor, fontVariant: ["tabular-nums"] }}>
                      {slotCals}
                    </Text>
                    <Text style={{ fontSize: 10, color: textTertiaryColor }}>kcal</Text>
                  </View>
                ) : (
                  <Ionicons name="add" size={14} color={textTertiaryColor} />
                )}
              </Pressable>
              {hasMeals &&
                isOpen &&
                meals.map((m) => (
                  <Swipeable
                    key={m.id}
                    overshootRight={false}
                    friction={2}
                    renderRightActions={() => (
                      <View style={{ flexDirection: "row", alignItems: "stretch" }}>
                        <Pressable
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            onDeleteMeal(m.id);
                          }}
                          style={{
                            width: 88,
                            backgroundColor: Accent.destructive,
                            justifyContent: "center",
                            alignItems: "center",
                            paddingVertical: 8,
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Remove meal"
                        >
                          <Ionicons name="trash-outline" size={22} color="#fff" />
                          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700", marginTop: 4 }}>Remove</Text>
                        </Pressable>
                      </View>
                    )}
                  >
                    <Pressable
                      onPress={() => onPressMeal(m.id)}
                      onLongPress={() => {
                        Alert.alert(m.recipeTitle, formatMealMacroDetail(m), [
                          { text: "Cancel", style: "cancel" },
                          { text: "Edit", onPress: () => onLongPressEdit(m) },
                          { text: "Copy to another day", onPress: () => onRequestCopyMeal(m.id) },
                          { text: "Delete", style: "destructive", onPress: () => onDeleteMeal(m.id) },
                        ]);
                      }}
                      style={{
                        paddingVertical: 9,
                        paddingLeft: 56,
                        paddingRight: 14,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottomWidth: 1,
                        borderBottomColor: cardBorderColor + "08",
                        backgroundColor: cardColor,
                      }}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Accent.success }} />
                          <Text style={{ fontSize: 12, color: textColor }} numberOfLines={1}>
                            {m.recipeTitle}
                          </Text>
                        </View>
                        {showMealTimestamps
                          ? (() => {
                              const ts = formatMealTimeDisplay(m.time, m.createdAt);
                              return ts ? (
                                <Text style={{ fontSize: 10, color: textTertiaryColor, marginLeft: 12 }}>{ts}</Text>
                              ) : null;
                            })()
                          : null}
                        {formatMealSourceLabelForRow(m.source) ? (
                          <Text
                            style={{ fontSize: 9, color: textTertiaryColor, marginLeft: 12, fontWeight: "500" }}
                          >
                            {formatMealSourceLabelForRow(m.source)}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 12, color: textSecondaryColor, fontVariant: ["tabular-nums"] }}>
                          {Math.round(m.calories)}
                        </Text>
                        <Ionicons name="chevron-forward" size={12} color={textTertiaryColor} />
                      </View>
                    </Pressable>
                  </Swipeable>
                ))}
            </View>
          );
        })}
        <Pressable style={{ padding: 12, alignItems: "center" }} onPress={() => onOpenFabForSlot("Snacks")}>
          <Text style={{ fontSize: 12, color: Accent.primary, fontWeight: "500" }}>+ Add Food</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default TodayMealsSection;
