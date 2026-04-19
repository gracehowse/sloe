import React, { useState } from "react";
import { Alert, Modal, Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Accent, MacroColors, Radius, Spacing } from "@/constants/theme";
import type { JournalMeal } from "@/lib/nutritionJournal";
import type { SavedMeal } from "../../../../src/lib/nutrition/savedMeals";
import { summariseSavedMeal } from "../../../../src/lib/nutrition/savedMealsLogic";

/**
 * TodayMealsSection — per-slot meal list with swipe-to-delete, long-press
 * menu, slot-header `Log usual` pill, full-width Save-as-usual row, and
 * the first-run hint.
 *
 * Ship M1 (2026-04-18). Saved meals is the canonical re-log mechanism:
 *  - Right-side slot-header action: `[↻ Log usual: <name>]` pill when ≥1
 *    saved meal matches the slot. 2+ matches open a picker modal.
 *  - Full-width row below the last item: `+ Save {Slot} as a meal` when
 *    the slot has ≥2 items AND no saved meal yet for this slot.
 *  - First-run hint renders above the full-width save row when the host
 *    passes a `hintVisibleForSlot(slot)` truthy value.
 *
 * The prior 10px "Save combo" chip is deleted. All user-facing "combo"
 * strings are replaced with "usual meal".
 */

export interface TodayMealsSectionProps {
  slots: readonly string[];
  mealGroups: Record<string, JournalMeal[]>;
  mealsTodayCount: number;
  collapsedSlots: Set<string>;
  onToggleSlotCollapse: (slot: string) => void;
  onOpenFabForSlot: (slot: string) => void;
  /** Open the save-as-usual sheet pre-seeded with the items in `slot`. */
  onOpenSaveUsualMealForSlot: (slot: string) => void;
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
  /** Ship M1 — all saved meals the user owns, sorted newest-logged-first. */
  savedMeals: readonly SavedMeal[];
  /** Ship M1 — log a saved meal into a specific slot. */
  onLogSavedMeal: (meal: SavedMeal, slot: string) => void;
  /** Ship M1 — whether the first-run hint is allowed to render in `slot`. */
  hintVisibleForSlot: (slot: string) => boolean;
  /** Ship M1 — user tapped "Not now" on the hint for `slot`. */
  onDismissUsualMealHint: (slot: string) => void;
  /** Ship M1 — user tapped "Save as usual" on the hint for `slot`. */
  onAcceptUsualMealHint: (slot: string) => void;
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

/** Pull the saved meals whose `defaultMealSlot === slot`, newest-logged first. */
function savedMealsForSlot(meals: readonly SavedMeal[], slot: string): SavedMeal[] {
  const out: SavedMeal[] = [];
  for (const m of meals) {
    if (m.defaultMealSlot === slot) out.push(m);
  }
  return out.sort((a, b) => {
    const ta = a.lastLoggedAt ? Date.parse(a.lastLoggedAt) : 0;
    const tb = b.lastLoggedAt ? Date.parse(b.lastLoggedAt) : 0;
    if (ta !== tb) return tb - ta;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export function TodayMealsSection(props: TodayMealsSectionProps) {
  const {
    slots,
    mealGroups,
    mealsTodayCount,
    collapsedSlots,
    onToggleSlotCollapse,
    onOpenFabForSlot,
    onOpenSaveUsualMealForSlot,
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
    savedMeals,
    onLogSavedMeal,
    hintVisibleForSlot,
    onDismissUsualMealHint,
    onAcceptUsualMealHint,
  } = props;

  const [usualPicker, setUsualPicker] = useState<
    { slot: string; options: SavedMeal[] } | null
  >(null);

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
          const slotSaved = savedMealsForSlot(savedMeals, slot);
          const hasSaved = slotSaved.length > 0;
          const showSaveRow = meals.length >= 2 && !hasSaved;
          const showHint = !hasSaved && meals.length >= 1 && hintVisibleForSlot(slot);
          const primarySaved = slotSaved[0];
          const extraSavedCount = slotSaved.length - 1;
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
                    {/* F-17 (2026-04-19, TestFlight `AIjmgrBMmY-M6B363x_hT8I`)
                        — populated slots had no "+" affordance, leaving the
                        tester stuck ("now I've added yogurt for breakfast
                        I can't add anything else"). Render a compact plus
                        pill on populated rows that opens the same
                        slot-scoped food search the empty-state "Tap to add"
                        uses. `stopPropagation` prevents the outer row
                        Pressable (which toggles slot collapse) from
                        firing. */}
                    <Pressable
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        onOpenFabForSlot(slot);
                      }}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Add another item to ${slot}`}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: Accent.primary + "14",
                        borderWidth: 1,
                        borderColor: Accent.primary + "40",
                      }}
                    >
                      <Ionicons name="add" size={16} color={Accent.primary} />
                    </Pressable>
                    {/* Ship M1 — `Log usual: {name}` pill. 2+ matches open
                        the picker modal; 1 match logs on tap. */}
                    {hasSaved && primarySaved && (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          if (slotSaved.length >= 2) {
                            setUsualPicker({ slot, options: slotSaved });
                          } else {
                            onLogSavedMeal(primarySaved, slot);
                          }
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={
                          slotSaved.length >= 2
                            ? `Log a usual ${slot} — choose from ${slotSaved.length} saved meals`
                            : `Log usual ${slot}: ${primarySaved.name}`
                        }
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: Accent.primary + "18",
                          borderWidth: 1,
                          borderColor: Accent.primary + "40",
                        }}
                      >
                        <Ionicons name="refresh-outline" size={11} color={Accent.primary} />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: Accent.primary,
                            maxWidth: 120,
                          }}
                          numberOfLines={1}
                        >
                          {extraSavedCount > 0 ? "Log usual…" : `Log usual: ${primarySaved.name}`}
                        </Text>
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
              {/* Ship M1 — first-run hint inside the slot body. Teaches
                  the feature once per slot then stops. */}
              {hasMeals && isOpen && showHint && (
                <View
                  accessibilityRole="summary"
                  accessibilityLabel={`Tip — make this your usual ${slot}`}
                  style={{
                    marginHorizontal: 12,
                    marginVertical: 6,
                    padding: 12,
                    borderRadius: Radius.md,
                    backgroundColor: Accent.primary + "0D",
                    borderWidth: 1,
                    borderColor: Accent.primary + "40",
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: textColor }}>
                    Make this your usual {slot.toLowerCase()}.
                  </Text>
                  <Text style={{ fontSize: 11, color: textTertiaryColor, marginTop: 2 }}>
                    One tap to re-log it tomorrow.
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                    <Pressable
                      onPress={() => onAcceptUsualMealHint(slot)}
                      accessibilityRole="button"
                      accessibilityLabel={`Save ${slot} as a usual meal`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: Radius.sm,
                        backgroundColor: Accent.primary,
                      }}
                    >
                      <Ionicons name="bookmark-outline" size={12} color="#fff" />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>
                        Save as usual
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onDismissUsualMealHint(slot)}
                      accessibilityRole="button"
                      accessibilityLabel={`Dismiss usual-meal hint for ${slot}`}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "600", color: textSecondaryColor }}>
                        Not now
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Ship M1 — full-width "Save {Slot} as a meal" row. */}
              {hasMeals && isOpen && showSaveRow && (
                <Pressable
                  onPress={() => onOpenSaveUsualMealForSlot(slot)}
                  accessibilityRole="button"
                  accessibilityLabel={`Save ${slot} as a usual meal — one tap to re-log next time`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderTopWidth: 1,
                    borderTopColor: cardBorderColor + "30",
                  }}
                >
                  <Ionicons name="bookmark-outline" size={14} color={Accent.primary} />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: Accent.primary }}>
                    Save {slot} as a meal
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
        <Pressable style={{ padding: 12, alignItems: "center" }} onPress={() => onOpenFabForSlot("Snacks")}>
          <Text style={{ fontSize: 12, color: Accent.primary, fontWeight: "500" }}>+ Add Food</Text>
        </Pressable>
      </View>

      {/* Ship M1 — usual-meal picker for slots with 2+ matches. */}
      <Modal
        visible={usualPicker != null}
        transparent
        animationType="fade"
        onRequestClose={() => setUsualPicker(null)}
      >
        <Pressable
          onPress={() => setUsualPicker(null)}
          style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: cardColor,
              borderTopLeftRadius: Radius.lg,
              borderTopRightRadius: Radius.lg,
              padding: Spacing.lg,
              paddingBottom: Spacing.xl,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: textColor, marginBottom: 2 }}>
              {usualPicker ? `Log a usual ${usualPicker.slot}` : "Log a usual meal"}
            </Text>
            <Text style={{ fontSize: 12, color: textSecondaryColor, marginBottom: Spacing.md }}>
              Pick which saved meal to log. Newest logged first.
            </Text>
            {(usualPicker?.options ?? []).slice(0, 3).map((m) => {
              const summary = summariseSavedMeal(m);
              const itemsLabel =
                summary.itemCount === 1 ? "1 item" : `${summary.itemCount} items`;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    if (usualPicker) {
                      onLogSavedMeal(m, usualPicker.slot);
                    }
                    setUsualPicker(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Log ${m.name} — ${itemsLabel}, ${summary.totalCalories} kcal`}
                  style={{
                    padding: Spacing.md,
                    borderRadius: Radius.lg,
                    borderWidth: 1,
                    borderColor: cardBorderColor,
                    marginBottom: Spacing.sm,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: textColor }} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: textSecondaryColor, marginTop: 2 }}>
                    {itemsLabel} · {summary.totalCalories} kcal · P {Math.round(summary.totalProtein)}g · C{" "}
                    {Math.round(summary.totalCarbs)}g · F {Math.round(summary.totalFat)}g
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setUsualPicker(null)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={{
                paddingVertical: 10,
                alignItems: "center",
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: cardBorderColor,
                marginTop: Spacing.xs,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: textColor }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default TodayMealsSection;
