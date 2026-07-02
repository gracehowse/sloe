import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  type RecipeYieldEditorDraft,
  type RecipeYieldEditorMode,
} from "@suppr/shared/recipes/recipeYieldEditor";

const MODES: Array<{ id: RecipeYieldEditorMode; label: string }> = [
  { id: "servings_only", label: "Servings" },
  { id: "weight", label: "By weight" },
  { id: "units", label: "By piece" },
  { id: "weight_and_units", label: "Weight + pieces" },
];

export type RecipeYieldEditorFieldsProps = {
  draft: RecipeYieldEditorDraft;
  onChange: (next: RecipeYieldEditorDraft) => void;
  disabled?: boolean;
};

export function RecipeYieldEditorFields({ draft, onChange, disabled }: RecipeYieldEditorFieldsProps) {
  const colors = useThemeColors();
  const accent = useAccent();

  const setMode = (mode: RecipeYieldEditorMode) => {
    onChange({ ...draft, mode });
  };

  return (
    <View style={styles.wrap} testID="recipe-yield-editor">
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Batch yield</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Optional — define total batch weight or pieces so you can log by grams or slices.
      </Text>
      <View style={styles.chipRow}>
        {MODES.map((m) => {
          const active = draft.mode === m.id;
          return (
            <Pressable
              key={m.id}
              testID={`recipe-yield-mode-${m.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              disabled={disabled}
              onPress={() => setMode(m.id)}
              style={[
                styles.chip,
                {
                  borderColor: active ? accent.primarySolid : colors.border,
                  backgroundColor: active ? accent.primarySoft : colors.background,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? accent.primarySolid : colors.text },
                ]}
              >
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {draft.mode !== "servings_only" ? (
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            Recipe makes (servings)
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            keyboardType="number-pad"
            editable={!disabled}
            value={String(draft.servings)}
            onChangeText={(t) =>
              onChange({ ...draft, servings: Number.parseInt(t, 10) || 1 })
            }
          />
        </View>
      ) : null}

      {draft.mode === "weight" || draft.mode === "weight_and_units" ? (
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            Total batch weight (g)
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            keyboardType="decimal-pad"
            editable={!disabled}
            value={draft.totalGrams}
            onChangeText={(t) => onChange({ ...draft, totalGrams: t })}
            placeholder="e.g. 680"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      ) : null}

      {draft.mode === "units" || draft.mode === "weight_and_units" ? (
        <View style={styles.row}>
          <View style={[styles.field, styles.flex]}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Pieces</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              keyboardType="number-pad"
              editable={!disabled}
              value={draft.unitCount}
              onChangeText={(t) => onChange({ ...draft, unitCount: t })}
              placeholder="12"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={[styles.field, styles.flex]}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              editable={!disabled}
              value={draft.unitSingular}
              onChangeText={(t) => onChange({ ...draft, unitSingular: t })}
              placeholder="slice"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  sectionLabel: {
    ...Type.caption,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  hint: { ...Type.caption },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipText: { ...Type.body, fontSize: 13, fontWeight: "600" },
  field: { gap: Spacing.xs },
  fieldLabel: { ...Type.caption },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Type.body,
  },
  row: { flexDirection: "row", gap: Spacing.md },
  flex: { flex: 1 },
});

export default RecipeYieldEditorFields;
