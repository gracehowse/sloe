import React from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { useAccent } from "@/context/theme";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import {
  Accent,
  Elevation,
  IconSize,
  MacroColors,
  Radius,
  Spacing,
  Type,
} from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { isFeatureEnabled } from "@/lib/analytics";
import { useSheetMorph } from "@/lib/motion";
import type { JournalMeal } from "@/lib/nutritionJournal";
import { PressableScale } from "../ui/PressableScale";
import { PortionStepper, clampPortion, formatMultiplier } from "./PortionStepper";

/**
 * TodayEditMealModal — edit-entry bottom sheet (slot, portion, manual
 * macros).
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). The host still owns the canonical-macros ref + the
 * save/delete write path — this is just rendering.
 *
 * ENG-783 (2026-05-30): `enabled` flips this between two renderers,
 * gated by the host on `isFeatureEnabled("today-edit-entry-v2")`:
 *  - `EditEntryV2` (flag ON) — full reskin to the canonical `LogSheet`
 *    sheet grammar (drag handle, headered, `colors.background`,
 *    scrollable body, sticky footer). Fixes the three complaints from
 *    Grace's red-line: (1) the legacy anonymous-beige-box look, (2) the
 *    "popup floating over Today" feel — V2 reads as the same sheet
 *    family as the log menu, and (3) labelled, dotted, unit-suffixed
 *    macro inputs + an explicit PORTION stepper. The active slot pill
 *    uses the soft-tint + primary-border language (ENG-782 contrast fix)
 *    instead of solid indigo with ~3.34:1 white text.
 *  - `EditEntryLegacy` (flag OFF) — the pre-ENG-783 body, byte-identical,
 *    kept alive in the `else` per the feature-flag rollout rule.
 */
export interface TodayEditMealModalProps {
  /** ENG-783 — when true, render the LogSheet-grammar `EditEntryV2`. */
  enabled?: boolean;
  /** ENG-772 — when true, show editable consumption time (`editable_eaten_at`). */
  editEatenAtEnabled?: boolean;
  editEatenAtTime: string;
  onEditEatenAtTimeChange: (v: string) => void;
  editingMeal: JournalMeal | null;
  slots: readonly string[];
  editSlot: string;
  onEditSlotChange: (slot: string) => void;
  editPortion: string;
  onEditPortionChange: (v: string) => void;
  onApplyPortionMultiplier: (mult: number) => void;
  editTitle: string;
  onEditTitleChange: (v: string) => void;
  editKcal: string;
  onEditKcalChange: (v: string) => void;
  editProtein: string;
  onEditProteinChange: (v: string) => void;
  editCarbs: string;
  onEditCarbsChange: (v: string) => void;
  editFat: string;
  onEditFatChange: (v: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
  styles: Record<string, any>;
  cardColor: string;
  borderColor: string;
  inputBgColor: string;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
}

/** Flag-aware shell — picks the renderer; all wiring is identical. */
export function TodayEditMealModal(props: TodayEditMealModalProps) {
  if (props.enabled) return <EditEntryV2 {...props} />;
  return <EditEntryLegacy {...props} />;
}

/** Parse the host's portion string into a clamped multiplier — the
 * clamp matches the host's `applyEditPortionMultiplier` ([0.125, 24]). */
function parsePortion(raw: string): number {
  return clampPortion(parseFloat(String(raw).replace(",", ".")) || 1);
}

function EditEatenAtTimeField(props: {
  enabled?: boolean;
  value: string;
  onChange: (v: string) => void;
  labelColor: string;
  inputBg: string;
  borderColor: string;
  textColor: string;
  placeholderColor: string;
  inputStyle?: object;
}) {
  if (!props.enabled) return null;
  return (
    <>
      <Text style={[Type.label, { color: props.labelColor, marginTop: Spacing.lg, marginBottom: Spacing.xs }]}>
        Time eaten
      </Text>
      <TextInput
        testID="edit-meal-time-eaten"
        style={[
          props.inputStyle,
          {
            backgroundColor: props.inputBg,
            color: props.textColor,
            borderColor: props.borderColor,
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            // Token retrofit (audit 2026-06-12 P2): the `fontSize:14 /
            // fontWeight:"500"` literals were the value-identical `Type.body`
            // ramp step — swapped so write-time discipline holds. `Type.body`
            // adds the Inter family + lineHeight 20 (a no-op on a single-line
            // input); size/weight pixels are unchanged.
            ...Type.body,
          },
        ]}
        placeholder="HH:mm (24h)"
        placeholderTextColor={props.placeholderColor}
        value={props.value}
        onChangeText={props.onChange}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel="Time eaten"
      />
    </>
  );
}

/**
 * EditEntryV2 — the redesigned sheet. Renders on `colors.background`
 * (the LogSheet surface, NOT `cardColor`) so it reads as the same sheet
 * family as the log menu rather than a popup floating over Today. Calls
 * `useThemeColors()` itself; ignores the legacy color props.
 */
function EditEntryV2(props: TodayEditMealModalProps) {
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const card = useCardElevation();
  const {
    editingMeal,
    slots,
    editSlot,
    onEditSlotChange,
    editPortion,
    onApplyPortionMultiplier,
    editTitle,
    onEditTitleChange,
    editKcal,
    onEditKcalChange,
    editProtein,
    onEditProteinChange,
    editCarbs,
    onEditCarbsChange,
    editFat,
    onEditFatChange,
    onSave,
    onDelete,
    onClose,
    editEatenAtEnabled,
    editEatenAtTime,
    onEditEatenAtTimeChange,
  } = props;

  // ENG-813 (Redesign — Design Direction 2026): element→sheet morph on open
  // + soft-elevation resting cards + quiet log-confirm haptic, all gated by
  // the redesign flags. The OLD `animationType="slide"` + flat inline-border
  // inputs both stay alive in the flag-off path.
  const open = !!editingMeal;
  const motionEnabled = isFeatureEnabled("redesign_motion");
  const { sheetStyle } = useSheetMorph(open && motionEnabled);

  const portionNum = parsePortion(editPortion);
  const portionLabel = formatMultiplier(portionNum);

  // Quiet selection haptic on portion recalc (the ±/chip-committed value,
  // never raw keystrokes) — a Light stepper beat. The durable Save CTA fires
  // the heavier Medium ("confirm") commit beat (ENG-1016).
  const onPortionChange = (next: number) => {
    if (motionEnabled) {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        /* haptics unavailable (e.g. Expo Go) — silent */
      }
    }
    onApplyPortionMultiplier(next);
  };

  const macroFields = [
    { key: "calories", label: "Calories", unit: "kcal", color: MacroColors.calories, value: editKcal, onChange: onEditKcalChange },
    { key: "protein", label: "Protein", unit: "g", color: MacroColors.protein, value: editProtein, onChange: onEditProteinChange },
    { key: "carbs", label: "Carbs", unit: "g", color: MacroColors.carbs, value: editCarbs, onChange: onEditCarbsChange },
    { key: "fat", label: "Fat", unit: "g", color: MacroColors.fat, value: editFat, onChange: onEditFatChange },
  ] as const;
  const macroRows = [macroFields.slice(0, 2), macroFields.slice(2, 4)];

  return (
    <Modal
      visible={open}
      transparent
      // Motion ON → the spring drives the entry, so the Modal must NOT also
      // slide (double-animation jank). Motion OFF → keep the native slide.
      animationType={motionEnabled ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <View style={v2.modalRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={[StyleSheet.absoluteFill, v2.backdrop]}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={v2.keyboardAvoid}
          pointerEvents="box-none"
        >
          {/* Outer wrapper carries ONLY the morph transform (animated style)
              — the static panel styling lives on the inner View so the
              animated + static styles never share one array (the proven
              `NorthStarBlock` split). Motion OFF → no transform. */}
          <Animated.View style={(motionEnabled ? sheetStyle : undefined) as StyleProp<ViewStyle>}>
            <View
              accessibilityViewIsModal
              accessibilityLabel="Edit entry"
              style={[v2.sheet, Elevation.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}
            >
              {/* Drag handle */}
              <View style={[v2.handle, { backgroundColor: colors.border }]} accessible={false} />

            {/* Header */}
            <View style={[v2.header, { borderBottomColor: colors.border }]}>
              <Text style={[Type.headline, { color: colors.text }]}>Edit entry</Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close edit entry"
                hitSlop={8}
                style={({ pressed }) => [v2.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <X size={IconSize.hero} color={colors.textSecondary} strokeWidth={2.25} />
              </Pressable>
            </View>

            <ScrollView
              style={v2.scroll}
              contentContainerStyle={v2.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* NAME — a recessed input field. Under
                  `design_system_elevation` it loses its hairline and takes
                  the tonal lift bg (the soft drop-shadow stays reserved for
                  the lifted *card* surfaces, not recessed inputs); flat
                  hairline otherwise. */}
              <Text style={[Type.label, v2.sectionLabel, { color: colors.textTertiary }]}>Name</Text>
              <TextInput
                style={[
                  v2.nameInput,
                  {
                    backgroundColor: card.liftBg ?? colors.inputBg,
                    color: colors.text,
                    borderColor: colors.border,
                    borderWidth: card.useBorder ? 1 : 0,
                  },
                ]}
                placeholder="Food name"
                placeholderTextColor={colors.textTertiary}
                value={editTitle}
                onChangeText={onEditTitleChange}
                accessibilityLabel="Food name"
              />

              {/* MEAL slot pills — canonical soft-tint selection (ENG-782). */}
              <Text style={[Type.label, v2.sectionLabel, v2.sectionSpaced, { color: colors.textTertiary }]}>Meal</Text>
              <View
                style={v2.slotRow}
                accessibilityRole="radiogroup"
                accessibilityLabel="Meal slot"
                testID="edit-entry-slot-row"
              >
                {slots.map((s) => {
                  const active = editSlot === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => onEditSlotChange(s)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Move to ${s}`}
                      testID={`edit-entry-slot-${s.toLowerCase()}`}
                      style={[
                        v2.slotPill,
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
                        {s}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <EditEatenAtTimeField
                enabled={editEatenAtEnabled}
                value={editEatenAtTime}
                onChange={onEditEatenAtTimeChange}
                labelColor={colors.textTertiary}
                inputBg={card.liftBg ?? colors.inputBg}
                borderColor={colors.border}
                textColor={colors.text}
                placeholderColor={colors.textTertiary}
              />

              {/* PORTION — live N× read-out + stepper + quick chips. */}
              <View style={[v2.sectionRow, v2.sectionSpaced]}>
                <Text style={[Type.label, { color: colors.textTertiary }]}>Portion</Text>
                <Text style={[Type.headline, { color: colors.text }]} accessibilityLabel={`Current portion ${portionLabel} times`}>
                  {portionLabel}×
                </Text>
              </View>
              <PortionStepper
                value={portionNum}
                onChange={onPortionChange}
                colors={colors}
                testIDPrefix="edit-entry-portion"
              />

              {/* NUTRITION — labelled, dotted, unit-suffixed 2×2 grid. */}
              <Text style={[Type.label, v2.sectionLabel, v2.sectionSpaced, { color: colors.textTertiary }]}>Nutrition</Text>
              <View style={v2.macroGrid}>
                {macroRows.map((row, i) => (
                  <View key={i} style={v2.macroRowWrap}>
                    {row.map((m) => (
                      <View key={m.key} style={v2.macroCell}>
                        <View style={v2.macroLabelRow}>
                          <View style={[v2.macroDot, { backgroundColor: m.color }]} />
                          <Text style={[Type.caption, { color: colors.textSecondary }]}>{m.label}</Text>
                        </View>
                        <View
                          style={[
                            v2.macroInputWrap,
                            {
                              backgroundColor: card.liftBg ?? colors.inputBg,
                              borderColor: colors.border,
                              borderWidth: card.useBorder ? 1 : 0,
                            },
                          ]}
                        >
                          <TextInput
                            style={[v2.macroInput, { color: colors.text }]}
                            keyboardType="numeric"
                            value={m.value}
                            onChangeText={m.onChange}
                            accessibilityLabel={m.label}
                          />
                          <Text style={[Type.caption, { color: colors.textTertiary }]}>{m.unit}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
              <Text style={[Type.caption, v2.estimateNote, { color: colors.textTertiary }]}>
                Estimated values — edit any to correct.
              </Text>
            </ScrollView>

            {/* Sticky footer — destructive-left / primary-right (blue per
                Phase 0). Quiet log-confirm haptic on Save when motion is on. */}
            <View style={[v2.footer, { borderTopColor: colors.border }]}>
              <Pressable
                onPress={onDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete entry"
                style={[v2.deleteBtn, { borderColor: Accent.destructive + "30" }]}
              >
                <Text style={{ color: Accent.destructive, fontWeight: "700", fontSize: 14 }}>Delete</Text>
              </Pressable>
              <PressableScale
                onPress={onSave}
                haptic={motionEnabled ? "confirm" : "none"}
                accessibilityRole="button"
                accessibilityLabel="Save changes"
                style={[v2.saveBtn, { borderColor: accent.primarySolid }]}
              >
                <Text style={{ color: accent.primarySolid, ...Type.headline }}>Save changes</Text>
              </PressableScale>
            </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const v2 = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.5)" },
  keyboardAvoid: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    overflow: "hidden",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: Spacing.sm,
  },
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
  nameInput: {
    // borderWidth driven by `useCardElevation().useBorder` inline (ENG-813).
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 14,
    fontWeight: "500",
  },
  slotRow: { flexDirection: "row", gap: Spacing.xs },
  slotPill: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  macroGrid: { gap: Spacing.sm },
  macroRowWrap: { flexDirection: "row", gap: Spacing.sm },
  macroCell: { flex: 1 },
  macroLabelRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.xs },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    // borderWidth driven by `useCardElevation().useBorder` inline (ENG-813).
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: Spacing.xs,
  },
  macroInput: { flex: 1, fontSize: 17, fontWeight: "700" },
  estimateNote: { marginTop: Spacing.sm },
  footer: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  deleteBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, borderWidth: 1, height: 48 },
  // Sloe treatment system (2026-06-08): primary inline CTA → aubergine
  // outline (transparent fill + 1.5px primarySolid border + primarySolid
  // label), not a filled slab.
  saveBtn: { flex: 2, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: "transparent", borderWidth: 1.5, height: 48 },
});

/**
 * EditEntryLegacy — the pre-ENG-783 body, preserved verbatim. Kept alive
 * behind the `today-edit-entry-v2` flag's `else` per the rollout rule;
 * delete once V2 has held 100% for two weeks with no regression.
 */
function EditEntryLegacy(props: TodayEditMealModalProps) {
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const {
    editingMeal,
    slots,
    editSlot,
    onEditSlotChange,
    editPortion,
    onEditPortionChange,
    onApplyPortionMultiplier,
    editTitle,
    onEditTitleChange,
    editKcal,
    onEditKcalChange,
    editProtein,
    onEditProteinChange,
    editCarbs,
    onEditCarbsChange,
    editFat,
    onEditFatChange,
    onSave,
    onDelete,
    onClose,
    styles,
    cardColor,
    borderColor,
    inputBgColor,
    textColor,
    textSecondaryColor,
    textTertiaryColor,
    editEatenAtEnabled,
    editEatenAtTime,
    onEditEatenAtTimeChange,
  } = props;

  return (
    <Modal visible={!!editingMeal} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }]}
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor: cardColor,
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            paddingTop: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.xl,
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: borderColor,
              alignSelf: "center",
              marginBottom: Spacing.lg,
            }}
          />
          {/* Header row: title + X close (audit 2026-04-30 modal-dismiss
              sweep — keyboard-up on iOS can hide the backdrop). */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: Spacing.md,
            }}
          >
            <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: textColor }}>Edit Entry</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
            >
              <X size={IconSize.hero} color={textSecondaryColor} strokeWidth={2.25} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.md }}>
            {slots.map((s) => (
              <Pressable
                key={s}
                onPress={() => onEditSlotChange(s)}
                style={{
                  flex: 1,
                  paddingVertical: Spacing.sm,
                  borderRadius: Radius.sm,
                  alignItems: "center",
                  // Sloe treatment system (2026-06-08): filter pill selected
                  // = aubergine soft-tint + primarySolid label, NOT a solid
                  // fill; unselected = transparent (legacy modal has no `colors`
                  // hook in scope — prop-based theming).
                  backgroundColor: editSlot === s ? accent.primarySoft : "transparent",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 11, fontWeight: "700", color: editSlot === s ? accent.primarySolid : textSecondaryColor }}
                >
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>

          <EditEatenAtTimeField
            enabled={editEatenAtEnabled}
            value={editEatenAtTime}
            onChange={onEditEatenAtTimeChange}
            labelColor={textSecondaryColor}
            inputBg={inputBgColor}
            borderColor={borderColor}
            textColor={textColor}
            placeholderColor={textTertiaryColor}
          />

          <Text style={{ fontSize: 12, fontWeight: "700", color: textSecondaryColor, marginBottom: Spacing.xs }}>
            Portion (×)
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.sm }}>
            {([0.5, 0.75, 1, 1.25, 1.5, 2] as const).map((mult) => (
              <Pressable
                key={mult}
                onPress={() => onApplyPortionMultiplier(mult)}
                style={{
                  paddingHorizontal: Spacing.dense,
                  paddingVertical: 8,
                  borderRadius: Radius.sm,
                  backgroundColor: inputBgColor,
                  borderWidth: 1,
                  borderColor: borderColor,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: textColor }}>{mult}×</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.input, { marginBottom: Spacing.md }]}
            placeholder="Portion multiplier (e.g. 1.25)"
            placeholderTextColor={textTertiaryColor}
            keyboardType="decimal-pad"
            value={editPortion}
            onChangeText={onEditPortionChange}
            onBlur={() => {
              const p = parseFloat(editPortion.replace(",", ".")) || 1;
              onApplyPortionMultiplier(p);
            }}
          />

          <TextInput
            style={styles.input}
            placeholder="Food name"
            placeholderTextColor={textTertiaryColor}
            value={editTitle}
            onChangeText={onEditTitleChange}
          />
          <View style={[styles.inputRow, { marginTop: Spacing.sm }]}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Calories"
              placeholderTextColor={textTertiaryColor}
              keyboardType="numeric"
              value={editKcal}
              onChangeText={onEditKcalChange}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Protein"
              placeholderTextColor={textTertiaryColor}
              keyboardType="numeric"
              value={editProtein}
              onChangeText={onEditProteinChange}
            />
          </View>
          <View style={[styles.inputRow, { marginTop: Spacing.sm }]}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Carbs"
              placeholderTextColor={textTertiaryColor}
              keyboardType="numeric"
              value={editCarbs}
              onChangeText={onEditCarbsChange}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Fat"
              placeholderTextColor={textTertiaryColor}
              keyboardType="numeric"
              value={editFat}
              onChangeText={onEditFatChange}
            />
          </View>
          <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md }}>
            {/* ENG-1016 — Save is a commit → Medium ("confirm") haptic via the
                canonical PressableScale primitive, matching the redesigned
                EditEntryV2 Save CTA. */}
            <PressableScale
              haptic="confirm"
              style={[styles.submitBtn, { flex: 1 }]}
              onPress={onSave}
            >
              <Text style={styles.submitBtnText}>Save Changes</Text>
            </PressableScale>
            <Pressable
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: Accent.destructive + "30",
                paddingVertical: Spacing.md,
              }}
              onPress={onDelete}
            >
              <Text style={{ color: Accent.destructive, fontWeight: "700", fontSize: 14 }}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default TodayEditMealModal;
