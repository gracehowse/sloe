import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { Accent, Elevation, IconSize, MacroColors, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { SavedMeal } from "@suppr/shared/nutrition/savedMeals";
import { summariseSavedMeal } from "@suppr/shared/nutrition/savedMealsLogic";
import { PortionStepper, formatMultiplier } from "./PortionStepper";

/**
 * SavedMealPortionSheet — pick a portion before logging a saved meal
 * (ENG-783, the third of Grace's three red-line asks: "when selected a
 * saved meal you should be able to edit the portion").
 *
 * Reachability is gated by the `today-edit-entry-v2` flag (host wires
 * `onRequestPortion` only when the flag is on):
 *   - flag ON  → tapping a saved meal (the "Log usual" slot-header pill,
 *                the usual-picker rows, and the LogSheet "Saved meals"
 *                rows) opens THIS sheet first; the user confirms a
 *                portion, then it logs.
 *   - flag OFF → those taps keep the instant one-tap 1× log (the old
 *                path stays alive in the `??` fallback at each call site),
 *                and this sheet never mounts.
 *
 * Shares the `LogSheet` sheet grammar + the shared `PortionStepper` with
 * the edit-entry sheet so the two never drift.
 *
 * Pure presentation: the host owns the slot + does the build/persist via
 * `buildMealEntriesFromSavedMeal(meal, slot, …, mealPortionMultiplier)`;
 * this sheet just reports the chosen multiplier back through `onConfirm`.
 */
export interface SavedMealPortionSheetProps {
  meal: SavedMeal | null;
  slot: string;
  slots: readonly string[];
  onChangeSlot: (slot: string) => void;
  onConfirm: (portionMultiplier: number) => void;
  onClose: () => void;
}

export function SavedMealPortionSheet({
  meal,
  slot,
  slots,
  onChangeSlot,
  onConfirm,
  onClose,
}: SavedMealPortionSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [mult, setMult] = useState(1);

  // Reset to 1× whenever a different saved meal opens the sheet.
  useEffect(() => {
    setMult(1);
  }, [meal?.id]);

  const base = meal ? summariseSavedMeal(meal) : null;
  const itemsLabel = base ? (base.itemCount === 1 ? "1 item" : `${base.itemCount} items`) : "";

  const scaled = base
    ? {
        kcal: Math.round(base.totalCalories * mult),
        protein: Math.round(base.totalProtein * mult),
        carbs: Math.round(base.totalCarbs * mult),
        fat: Math.round(base.totalFat * mult),
      }
    : { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  const macroSummary = [
    { key: "calories", label: "kcal", color: MacroColors.calories, value: scaled.kcal },
    { key: "protein", label: "P", color: MacroColors.protein, value: scaled.protein },
    { key: "carbs", label: "C", color: MacroColors.carbs, value: scaled.carbs },
    { key: "fat", label: "F", color: MacroColors.fat, value: scaled.fat },
  ] as const;

  return (
    <Modal visible={!!meal} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={[StyleSheet.absoluteFill, s.backdrop]}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.keyboardAvoid}
          pointerEvents="box-none"
        >
          <View
            accessibilityViewIsModal
            accessibilityLabel="Log saved meal with portion"
            style={[s.sheet, Elevation.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}
          >
            <View style={[s.handle, { backgroundColor: colors.border }]} accessible={false} />

            <View style={[s.header, { borderBottomColor: colors.border }]}>
              <Text style={[Type.headline, { color: colors.text }]} numberOfLines={1}>
                {meal?.name ?? "Saved meal"}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                style={({ pressed }) => [s.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <X size={IconSize.hero} color={colors.textSecondary} strokeWidth={2.25} />
              </Pressable>
            </View>

            <ScrollView
              style={s.scroll}
              contentContainerStyle={s.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {itemsLabel ? (
                <Text style={[Type.caption, { color: colors.textSecondary }]}>{itemsLabel}</Text>
              ) : null}

              {/* MEAL slot pills — canonical soft-tint selection. */}
              <Text style={[Type.label, s.sectionLabel, s.sectionSpaced, { color: colors.textTertiary }]}>Meal</Text>
              <View
                style={s.slotRow}
                accessibilityRole="radiogroup"
                accessibilityLabel="Meal slot"
                testID="saved-portion-slot-row"
              >
                {slots.map((opt) => {
                  const active = slot === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => onChangeSlot(opt)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Log to ${opt}`}
                      testID={`saved-portion-slot-${opt.toLowerCase()}`}
                      style={[
                        s.slotPill,
                        {
                          borderColor: active ? Accent.primary : colors.border,
                          backgroundColor: active ? Accent.primarySoft : "transparent",
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 12, fontWeight: "700", color: active ? colors.text : colors.textSecondary }}
                      >
                        {opt}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* PORTION — live N× read-out + shared stepper. */}
              <View style={[s.sectionRow, s.sectionSpaced]}>
                <Text style={[Type.label, { color: colors.textTertiary }]}>Portion</Text>
                <Text style={[Type.headline, { color: colors.text }]} accessibilityLabel={`Current portion ${formatMultiplier(mult)} times`}>
                  {formatMultiplier(mult)}×
                </Text>
              </View>
              <PortionStepper value={mult} onChange={setMult} colors={colors} testIDPrefix="saved-portion" />

              {/* Live scaled macro read-out. */}
              <View style={[s.macroRow, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                {macroSummary.map((m) => (
                  <View key={m.key} style={s.macroCell}>
                    <View style={s.macroLabelRow}>
                      <View style={[s.macroDot, { backgroundColor: m.color }]} />
                      <Text style={[Type.caption, { color: colors.textTertiary }]}>{m.label}</Text>
                    </View>
                    <Text style={[Type.macroValue, { color: colors.text }]}>{m.value}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Footer — single primary commit. */}
            <View style={[s.footer, { borderTopColor: colors.border }]}>
              <Pressable
                onPress={() => onConfirm(mult)}
                accessibilityRole="button"
                accessibilityLabel={`Log ${formatMultiplier(mult)} times to ${slot}`}
                testID="saved-portion-confirm"
                style={s.confirmBtn}
              >
                <Text style={{ color: Accent.primaryForeground, ...Type.headline }}>
                  {`Log ${formatMultiplier(mult)}× to ${slot}`}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.5)" },
  keyboardAvoid: { flex: 1, justifyContent: "flex-end" },
  sheet: { maxHeight: "92%", borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 8, marginBottom: 6 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  sectionLabel: { marginBottom: Spacing.xs },
  sectionSpaced: { marginTop: Spacing.lg },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  slotRow: { flexDirection: "row", gap: Spacing.xs },
  slotPill: { flex: 1, paddingVertical: 7, borderRadius: Radius.sm, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  macroRow: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
  },
  macroCell: { flex: 1, alignItems: "center", gap: Spacing.xs },
  macroLabelRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirmBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: Accent.primary,
    height: 48,
  },
});

export default SavedMealPortionSheet;
