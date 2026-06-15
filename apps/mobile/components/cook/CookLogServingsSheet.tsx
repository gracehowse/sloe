import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { SupprButton } from "@/components/ui/SupprButton";
import { PortionStepper, formatMultiplier } from "@/components/today/PortionStepper";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export interface CookLogServingsSheetProps {
  visible: boolean;
  batchScale: number;
  baseServings: number | null;
  onConfirm: (servingsEaten: number) => void;
  onClose: () => void;
}

/** ENG-1129 — confirm servings eaten before cook-mode auto-log (batch scale ≠ eaten). */
export function CookLogServingsSheet({
  visible,
  batchScale,
  baseServings,
  onConfirm,
  onClose,
}: CookLogServingsSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [servingsEaten, setServingsEaten] = useState(1);

  const batchYield =
    baseServings != null && baseServings > 0
      ? Math.max(1, Math.round(baseServings * batchScale))
      : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View
          style={[
            s.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom, Spacing.lg),
            },
          ]}
        >
          <View style={s.header}>
            <Text style={[Type.title, { color: colors.text, flex: 1 }]}>How much did you eat?</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <X size={22} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
          <Text style={[Type.body, { color: colors.textSecondary, marginBottom: Spacing.md }]}>
            {batchScale !== 1
              ? `You cooked a ${formatMultiplier(batchScale)}× batch${
                  batchYield != null ? ` — serves ~${batchYield}` : ""
                }.`
              : "Confirm servings eaten — cook scale is your batch size, not what you ate."}
          </Text>
          <View style={s.row}>
            <Text style={[Type.label, { color: colors.textTertiary }]}>Servings eaten</Text>
            <Text style={[Type.headline, { color: colors.text }]}>
              {formatMultiplier(servingsEaten)}
            </Text>
          </View>
          <PortionStepper
            value={servingsEaten}
            onChange={setServingsEaten}
            colors={colors}
            testIDPrefix="cook-log-servings"
          />
          <SupprButton
            variant="primary"
            style={{ marginTop: Spacing.lg }}
            label="Log to Today"
            onPress={() => onConfirm(servingsEaten)}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
});
