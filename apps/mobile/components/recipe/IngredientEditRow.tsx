/**
 * IngredientEditRow — one editable ingredient row inside RecipeEditSheet
 * (ENG-759, mobile ingredient CRUD). Edits name / amount / unit inline
 * and exposes a trash button to delete. Macros are NOT editable here —
 * they're recomputed from the verify pipeline (existing per-ingredient
 * verify flow) so this surface never invents nutrition.
 */
import { memo } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Trash2 } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation, type CardElevation } from "@/hooks/useCardElevation";

export type EditableIngredient = {
  /** Stable key for React + DB row id when persisted. Null = not yet saved. */
  rowId: string | null;
  localKey: string;
  name: string;
  amount: string;
  unit: string;
  /** True for rows the user added manually in this session (no nutrition). */
  addedByUser?: boolean;
};

function IngredientEditRowImpl({
  ingredient,
  onChange,
  onDelete,
}: {
  ingredient: EditableIngredient;
  onChange: (patch: Partial<EditableIngredient>) => void;
  onDelete: () => void;
}) {
  const colors = useThemeColors();
  const cardElevation = useCardElevation();
  const styles = makeStyles(colors, cardElevation);
  return (
    <View style={styles.row}>
      <TextInput
        value={ingredient.name}
        onChangeText={(name) => onChange({ name })}
        placeholder="Ingredient"
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, styles.nameInput]}
        accessibilityLabel="Ingredient name"
      />
      <TextInput
        value={ingredient.amount}
        onChangeText={(amount) => onChange({ amount })}
        placeholder="Amt"
        placeholderTextColor={colors.textTertiary}
        keyboardType="decimal-pad"
        style={[styles.input, styles.amountInput]}
        accessibilityLabel="Ingredient amount"
      />
      <TextInput
        value={ingredient.unit}
        onChangeText={(unit) => onChange({ unit })}
        placeholder="Unit"
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, styles.unitInput]}
        accessibilityLabel="Ingredient unit"
      />
      <Pressable
        onPress={onDelete}
        hitSlop={8}
        style={styles.deleteBtn}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${ingredient.name || "ingredient"}`}
      >
        <Trash2 size={18} color={Accent.destructive} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useThemeColors>, ce: CardElevation) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
    },
    input: {
      borderWidth: ce.useBorder ? 1 : 0,
      borderColor: colors.border,
      borderRadius: Radius.sm,
      paddingVertical: 8,
      paddingHorizontal: 10,
      fontSize: 14,
      color: colors.text,
      backgroundColor: ce.liftBg ?? colors.inputBg,
    },
    nameInput: { flex: 1 },
    amountInput: { width: 56, textAlign: "center" },
    unitInput: { width: 64, textAlign: "center" },
    deleteBtn: { padding: 6 },
  });

export const IngredientEditRow = memo(IngredientEditRowImpl);
export default IngredientEditRow;
