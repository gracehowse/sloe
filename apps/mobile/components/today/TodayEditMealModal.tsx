import React from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { Accent, IconSize, Radius, Spacing } from "@/constants/theme";
import type { JournalMeal } from "@/lib/nutritionJournal";

/**
 * TodayEditMealModal — edit-entry bottom sheet (slot, portion chips,
 * manual macros).
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). The host still owns the canonical-macros ref + the
 * save/delete write path — this is just rendering.
 */
export interface TodayEditMealModalProps {
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

export function TodayEditMealModal(props: TodayEditMealModalProps) {
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
  } = props;

  return (
    <Modal visible={!!editingMeal} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.5)" }]}
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor: cardColor,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
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
                  paddingVertical: 6,
                  borderRadius: Radius.sm,
                  alignItems: "center",
                  backgroundColor: editSlot === s ? Accent.primary : borderColor + "30",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 11, fontWeight: "700", color: editSlot === s ? "#fff" : textSecondaryColor }}
                >
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontSize: 12, fontWeight: "700", color: textSecondaryColor, marginBottom: Spacing.xs }}>
            Portion (×)
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: Spacing.sm }}>
            {([0.5, 0.75, 1, 1.25, 1.5, 2] as const).map((mult) => (
              <Pressable
                key={mult}
                onPress={() => onApplyPortionMultiplier(mult)}
                style={{
                  paddingHorizontal: 12,
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
            <Pressable style={[styles.submitBtn, { flex: 1 }]} onPress={onSave}>
              <Text style={styles.submitBtnText}>Save Changes</Text>
            </Pressable>
            <Pressable
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: Accent.destructive + "30",
                paddingVertical: 14,
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
