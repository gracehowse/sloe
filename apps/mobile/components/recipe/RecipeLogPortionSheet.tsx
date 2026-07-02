import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { PortionPicker } from "@/components/PortionPicker";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprButton } from "@/components/ui/SupprButton";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import {
  buildRecipeStructuredLogPicker,
  formatRecipePortionLogLabel,
  recipePortionSelectionFromPickerState,
  scaleRecipeLogMacros,
} from "@suppr/shared/recipes/recipeLogPortion";
import {
  canLogRecipeByUnits,
  type RecipeMacroPanel,
  type RecipeYieldDefinition,
} from "@suppr/nutrition-core/recipeYield";
import type { PortionState } from "@suppr/nutrition-core/portionPicker";

export type RecipeLogPortionConfirmPayload = {
  portion: ReturnType<typeof recipePortionSelectionFromPickerState>;
  portionLabel: string;
  macros: RecipeMacroPanel;
};

export type RecipeLogPortionSheetProps = {
  visible: boolean;
  onClose: () => void;
  recipeTitle: string;
  perServing: RecipeMacroPanel;
  baseServings: number;
  yieldDef: RecipeYieldDefinition;
  logging?: boolean;
  onConfirm: (payload: RecipeLogPortionConfirmPayload) => void | Promise<void>;
};

export function RecipeLogPortionSheet({
  visible,
  onClose,
  recipeTitle,
  perServing,
  baseServings,
  yieldDef,
  logging = false,
  onConfirm,
}: RecipeLogPortionSheetProps) {
  const colors = useThemeColors();
  const pickerOptions = useMemo(
    () => buildRecipeStructuredLogPicker(perServing, baseServings, yieldDef),
    [perServing, baseServings, yieldDef],
  );

  const unitsOnly =
    pickerOptions == null && canLogRecipeByUnits(yieldDef) && yieldDef.kind === "units";

  const [pickerState, setPickerState] = useState<PortionState | null>(pickerOptions?.initial ?? null);
  const [unitsCount, setUnitsCount] = useState(1);

  useEffect(() => {
    if (!visible) return;
    setPickerState(pickerOptions?.initial ?? null);
    setUnitsCount(1);
  }, [visible, pickerOptions]);

  const portion = useMemo(() => {
    if (unitsOnly && yieldDef.kind === "units") {
      return { mode: "units" as const, units: unitsCount };
    }
    if (!pickerState) return null;
    return recipePortionSelectionFromPickerState(pickerState);
  }, [unitsOnly, yieldDef, unitsCount, pickerState]);

  const preview = useMemo(() => {
    if (!portion) return null;
    return scaleRecipeLogMacros(perServing, baseServings, yieldDef, portion);
  }, [portion, perServing, baseServings, yieldDef]);

  const handleConfirm = async () => {
    if (!portion || !preview) return;
    await onConfirm({
      portion,
      portionLabel: formatRecipePortionLogLabel(portion, yieldDef),
      macros: preview,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: MODAL_OVERLAY_SCRIM }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>Log portion</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            How much of {recipeTitle} are you logging?
          </Text>

          {pickerOptions && pickerState ? (
            <PortionPicker
              product={{}}
              value={pickerState}
              onChange={setPickerState}
              options={pickerOptions}
              hideQuickChips
            />
          ) : unitsOnly && yieldDef.kind === "units" ? (
            <View style={styles.unitsRow}>
              <Pressable
                accessibilityRole="button"
                disabled={logging || unitsCount <= 1}
                onPress={() => setUnitsCount((n) => Math.max(1, n - 1))}
                style={[styles.stepBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.text }}>−</Text>
              </Pressable>
              <Text style={[styles.unitsCount, { color: colors.text }]}>{unitsCount}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={logging}
                onPress={() => setUnitsCount((n) => n + 1)}
                style={[styles.stepBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.text }}>+</Text>
              </Pressable>
              <Text style={{ color: colors.textSecondary }}>
                {unitsCount === 1 ? yieldDef.singular : yieldDef.plural}
              </Text>
            </View>
          ) : null}

          {preview ? (
            <Text style={[styles.preview, { color: colors.textSecondary }]}>
              ≈ {Math.round(preview.calories)} kcal · P {preview.protein} · C {preview.carbs} · F{" "}
              {preview.fat}
            </Text>
          ) : null}

          <View style={styles.footer}>
            <SupprButton variant="ghost" onPress={onClose} disabled={logging}>
              Cancel
            </SupprButton>
            <SupprButton
              variant="primary"
              onPress={() => void handleConfirm()}
              disabled={logging || !preview}
              loading={logging}
            >
              Log to Today
            </SupprButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  title: { ...Type.body, fontSize: 18, fontWeight: "700" },
  subtitle: { ...Type.bodyMuted },
  unitsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  stepBtn: {
    borderWidth: 1,
    borderRadius: Radius.md,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  unitsCount: { ...Type.body, fontSize: 20, fontWeight: "700", minWidth: 48, textAlign: "center" },
  preview: { ...Type.bodyMuted, textAlign: "center" },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: Spacing.sm },
});

export default RecipeLogPortionSheet;
