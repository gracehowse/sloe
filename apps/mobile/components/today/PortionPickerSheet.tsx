/**
 * PortionPickerSheet — bottom sheet for picking a portion when logging a
 * planned meal from the Today screen.
 *
 * Replaces the system `Alert.alert` previously used inside
 * `TodayPlannedMealsCard` (audit 2026-04-30: customer-lens flagged the
 * iOS alert as prototype-tier mid-flow). Visual pattern matches
 * `CopyMealSheet` / `DuplicateDaySheet` — modal + scrim + sheet card +
 * drag handle + close X + cancel button.
 */
import React, { memo } from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { Modal, Pressable, Text, View } from "react-native";
import { X } from "lucide-react-native";

import { Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprButton } from "@/components/ui/SupprButton";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";

const PORTIONS: { value: number; label: string }[] = [
  { value: 0.5, label: "½ ×" },
  { value: 1, label: "1 ×" },
  { value: 1.5, label: "1½ ×" },
  { value: 2, label: "2 ×" },
];

export type PortionPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  mealName: string;
  onPick: (portion: number) => void;
};

function PortionPickerSheetImpl({
  visible,
  onClose,
  mealName,
  onPick,
}: PortionPickerSheetProps) {
  const colors = useThemeColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close portion picker"
        accessibilityRole="button"
        style={{ flex: 1, backgroundColor: MODAL_OVERLAY_SCRIM, justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            padding: Spacing.lg,
            paddingBottom: Spacing.xl,
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: "center", marginBottom: Spacing.sm }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.cardBorder,
              }}
            />
          </View>

          {/* Close X (top-right) */}
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close"
            accessibilityRole="button"
            hitSlop={12}
            style={{
              position: "absolute",
              top: Spacing.md,
              right: Spacing.md,
              padding: 4,
              zIndex: 1,
            }}
          >
            <X size={24} strokeWidth={2.25} color={colors.textSecondary} />
          </Pressable>

          {/* Header */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: colors.text,
              marginBottom: 4,
              paddingRight: 32,
            }}
            numberOfLines={2}
          >
            {`Log ${mealName}`}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              marginBottom: Spacing.md,
            }}
          >
            How much did you eat?
          </Text>

          {/* Portion list */}
          <View style={{ marginBottom: Spacing.md }}>
            {PORTIONS.map((p, i) => (
              <Pressable
                key={p.value}
                onPress={() => {
                  onPick(p.value);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel={`${p.label} portion`}
                style={{
                  minHeight: 44,
                  paddingVertical: Spacing.dense,
                  paddingHorizontal: 4,
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: i === PORTIONS.length - 1 ? 0 : 1,
                  borderBottomColor: colors.cardBorder,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: colors.text,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Cancel — Button system (2026-06-12,
              docs/decisions/2026-06-12-button-system-solid-primary.md): the
              secondary dismiss is a ghost SupprButton (transparent, plum
              label), replacing the old bordered-outline treatment. The portion
              rows above are selection rows (commit-on-tap), not buttons — they
              stay as-is. The sheet itself keeps its sanctioned elevation. */}
          <SupprButton
            variant="ghost"
            onPress={onClose}
            accessibilityLabel="Cancel"
            label="Cancel"
            haptic="selection"
            style={{ alignSelf: "stretch" }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const PortionPickerSheet = memo(PortionPickerSheetImpl);

export default PortionPickerSheet;
