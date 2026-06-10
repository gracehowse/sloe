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
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { Elevation, IconSize, MacroColors, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { isFeatureEnabled } from "@/lib/analytics";
import { useSheetMorph } from "@/lib/motion";
import type { SavedMeal } from "@suppr/shared/nutrition/savedMeals";
import { summariseSavedMeal } from "@suppr/shared/nutrition/savedMealsLogic";
import { PressableScale } from "../ui/PressableScale";
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
  // Slot pill border/fill + footer CTA outline use the scheme-resolved
  // accent so deep plum stays legible on dark (hook inverts to aubergine).
  const accent = useAccent();
  const card = useCardElevation();
  const [mult, setMult] = useState(1);

  // ENG-813 (Redesign — Design Direction 2026): the element→sheet morph on
  // open + the resting-card soft-elevation token, gated by the redesign
  // flags. The OLD `animationType="slide"` + flat read-out card both stay
  // alive in the flag-off path.
  const open = !!meal;
  const motionEnabled = isFeatureEnabled("redesign_motion");
  const { sheetStyle } = useSheetMorph(open && motionEnabled);

  // Reset to 1× whenever a different saved meal opens the sheet.
  useEffect(() => {
    setMult(1);
  }, [meal?.id]);

  // Quiet log-confirm haptic on portion recalc (the ±/chip-committed value),
  // never on raw keystrokes — the stepper only calls `onChange` with a
  // settled multiplier. Same Light-impact "confirm" feel as the commit CTA's
  // `PressableScale haptic="confirm"`.
  const onPortionChange = (next: number) => {
    if (motionEnabled) {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        /* haptics unavailable (e.g. Expo Go) — silent */
      }
    }
    setMult(next);
  };

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
    <Modal
      visible={open}
      transparent
      // Motion ON → the spring drives the entry, so the Modal must NOT also
      // slide (double-animation jank). Motion OFF → keep the native slide.
      animationType={motionEnabled ? "none" : "slide"}
      onRequestClose={onClose}
    >
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
          {/* Outer wrapper carries ONLY the morph transform (animated style)
              — the static panel styling lives on the inner View so the
              animated + static styles never share one array (the proven
              `NorthStarBlock` split). Motion OFF → no transform. */}
          <Animated.View style={(motionEnabled ? sheetStyle : undefined) as StyleProp<ViewStyle>}>
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
                          borderColor: active ? accent.primary : colors.border,
                          backgroundColor: active ? accent.primarySoft : "transparent",
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
              <PortionStepper value={mult} onChange={onPortionChange} colors={colors} testIDPrefix="saved-portion" />

              {/* Live scaled macro read-out — a resting card; takes the soft
                  elevation token (no border) under `design_system_elevation`,
                  the flat hairline otherwise. */}
              <View
                style={[
                  s.macroRow,
                  card.shadowStyle,
                  {
                    borderColor: colors.border,
                    borderWidth: card.useBorder ? StyleSheet.hairlineWidth : 0,
                    backgroundColor: card.liftBg ?? colors.inputBg,
                  },
                ]}
              >
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

            {/* Footer — single primary commit (blue per Phase 0). Quiet
                log-confirm haptic on tap when motion is on. */}
            <View style={[s.footer, { borderTopColor: colors.border }]}>
              <PressableScale
                onPress={() => onConfirm(mult)}
                haptic={motionEnabled ? "confirm" : "none"}
                accessibilityRole="button"
                accessibilityLabel={`Log ${formatMultiplier(mult)} times to ${slot}`}
                testID="saved-portion-confirm"
                style={[s.confirmBtn, { borderColor: accent.primarySolid }]}
              >
                <Text style={{ color: accent.primarySolid, ...Type.headline }}>
                  {`Log ${formatMultiplier(mult)}× to ${slot}`}
                </Text>
              </PressableScale>
            </View>
            </View>
          </Animated.View>
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
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 8, marginBottom: Spacing.sm },
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
  slotPill: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  macroRow: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    // borderWidth driven by `useCardElevation().useBorder` inline (ENG-813).
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
  // Sloe treatment system (2026-06-08): primary inline CTA → aubergine
  // outline (transparent fill + 1.5px primarySolid border + primarySolid
  // label), not a filled slab. `borderColor` is injected inline from
  // `accent.primarySolid` (scheme-resolved hook) so dark gets the lifted
  // aubergine; the rest of the shape is static.
  confirmBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    height: 48,
  },
});

export default SavedMealPortionSheet;
