/**
 * OverrideIngredientSheet (Batch 2.7) — bottom-sheet mirror of the web
 * `OverrideIngredientDialog`. Lets the user type label values for an
 * existing ingredient row; Save persists an override that replaces the
 * matched macros when computing totals, Reset clears it.
 *
 * Keeps parity with web by reusing the shared `sanitizeOverrideInput`
 * helper so the "what counts as an override" rule is defined in one place.
 */
import { useEffect, useState } from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { SupprButton } from "./ui/SupprButton";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import {
  sanitizeOverrideInput,
  type IngredientOverride,
} from "@suppr/shared/nutrition/ingredientOverrides";

type Theme = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  background: string;
  border: string;
  primaryForeground: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  ingredientName: string;
  /** Current effective macros (override or matched). Pre-fills the inputs. */
  currentMacros: { calories: number; protein: number; carbs: number; fat: number; fiber?: number };
  hasExistingOverride: boolean;
  onSave: (override: IngredientOverride) => void | Promise<void>;
  onReset: () => void | Promise<void>;
  colors: Theme;
};

export default function OverrideIngredientSheet({
  visible,
  onClose,
  ingredientName,
  currentMacros,
  hasExistingOverride,
  onSave,
  onReset,
  colors,
}: Props) {
  const [cal, setCal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [fiber, setFiber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCal(String(Math.round(currentMacros.calories)));
      setP(String(Math.round(currentMacros.protein * 10) / 10));
      setC(String(Math.round(currentMacros.carbs * 10) / 10));
      setF(String(Math.round(currentMacros.fat * 10) / 10));
      setFiber(
        currentMacros.fiber != null
          ? String(Math.round(currentMacros.fiber * 10) / 10)
          : "",
      );
      setSaving(false);
    }
  }, [visible, currentMacros]);

  const handleSave = async () => {
    Keyboard.dismiss();
    const sanitized = sanitizeOverrideInput({
      calories: cal,
      protein: p,
      carbs: c,
      fat: f,
      fiber,
    });
    if (!sanitized) {
      if (hasExistingOverride) await onReset();
      onClose();
      return;
    }
    setSaving(true);
    try {
      await onSave(sanitized);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await onReset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    row: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.md },
    half: { flex: 1 },
    label: { fontSize: 12, color: colors.textTertiary, fontWeight: "600", marginBottom: 4 },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
      fontVariant: ["tabular-nums"],
    },
    footer: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: Spacing.md,
      justifyContent: "flex-end",
      flexWrap: "wrap",
    },
    // Destructive (Reset) keeps its own treatment — NOT a SupprButton variant.
    btn: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
      borderRadius: Radius.md,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 96,
    },
    // Layout-only override for the SupprButton Cancel/Save (padding/radius/colour
    // come from the button system; this only matches the destructive button width).
    btnLayout: { minWidth: 96 },
    btnDestructive: { backgroundColor: "transparent", borderWidth: 1, borderColor: Accent.destructive + "80" },
    btnDestructiveText: { color: Accent.destructive, fontWeight: "600", fontSize: 14 },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: MODAL_OVERLAY_SCRIM, justifyContent: "flex-end" }}>
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
          <View style={{ alignItems: "center", marginBottom: Spacing.sm }}>
            <View style={{ width: 36, height: 4, borderRadius: Radius.full, backgroundColor: colors.cardBorder }} />
          </View>

          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
            Edit nutrition
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.md }}>
            {`Use the values from the ${ingredientName} label.`}
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Calories (kcal)</Text>
                <TextInput
                  style={styles.input}
                  value={cal}
                  onChangeText={setCal}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  autoFocus
                  accessibilityLabel="Calories from label"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Protein (g)</Text>
                <TextInput
                  style={styles.input}
                  value={p}
                  onChangeText={setP}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  accessibilityLabel="Protein from label"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Carbs (g)</Text>
                <TextInput
                  style={styles.input}
                  value={c}
                  onChangeText={setC}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  accessibilityLabel="Carbs from label"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Fat (g)</Text>
                <TextInput
                  style={styles.input}
                  value={f}
                  onChangeText={setF}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  accessibilityLabel="Fat from label"
                />
              </View>
            </View>
            <View>
              <Text style={styles.label}>Fiber (g) — optional</Text>
              <TextInput
                style={styles.input}
                value={fiber}
                onChangeText={setFiber}
                keyboardType="decimal-pad"
                inputMode="decimal"
                accessibilityLabel="Fiber from label"
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {hasExistingOverride ? (
              <Pressable
                style={[styles.btn, styles.btnDestructive]}
                onPress={() => void handleReset()}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Reset to matched macros"
              >
                <Text style={styles.btnDestructiveText}>Reset to match</Text>
              </Pressable>
            ) : null}
            <SupprButton
              variant="ghost"
              style={styles.btnLayout}
              onPress={onClose}
              disabled={saving}
              label="Cancel"
              accessibilityLabel="Cancel edit"
            />
            <SupprButton
              variant="primary"
              style={styles.btnLayout}
              onPress={() => void handleSave()}
              loading={saving}
              label="Save"
              accessibilityLabel="Save nutrition values"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
