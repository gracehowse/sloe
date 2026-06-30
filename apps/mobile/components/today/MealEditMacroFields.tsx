import * as React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { FontFamily, Radius, Spacing, Type } from "@/constants/theme";

interface MacroFieldSpec {
  key: string;
  label: string;
  unit: string;
  color: string;
  value: string;
  onChange: (text: string) => void;
}

export interface MealEditMacroFieldsProps {
  /** Calories — the headline metric, rendered as a serif hero (still editable). */
  kcal: { label: string; unit: string; color: string; value: string; onChange: (text: string) => void };
  /** Protein / carbs / fat — the secondary triple. */
  macros: ReadonlyArray<MacroFieldSpec>;
  textColor: string;
  labelColor: string;
  unitColor: string;
  fieldBg: string;
  borderColor: string;
  useBorder: boolean;
}

/**
 * The MealEdit nutrition block (ENG-1247): a serif kcal hero over the
 * protein/carbs/fat triple. Mirrors the v3 prototype's MealEdit hierarchy
 * (calories = headline, macros secondary) while keeping every value a direct
 * input — the app deliberately keeps editable fields rather than the
 * prototype's display-only tiles. Extracted from TodayEditMealModal to hold the
 * screen-line budget.
 */
export function MealEditMacroFields({
  kcal,
  macros,
  textColor,
  labelColor,
  unitColor,
  fieldBg,
  borderColor,
  useBorder,
}: MealEditMacroFieldsProps) {
  const wrapStyle = {
    backgroundColor: fieldBg,
    borderColor,
    borderWidth: useBorder ? 1 : 0,
  } as const;
  return (
    <View style={styles.grid}>
      <View>
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: kcal.color }]} />
          <Text style={[Type.caption, { color: labelColor }]}>{kcal.label}</Text>
        </View>
        <View style={[styles.kcalInputWrap, wrapStyle]}>
          <TextInput
            style={[styles.kcalInput, { color: textColor }]}
            keyboardType="numeric"
            value={kcal.value}
            onChangeText={kcal.onChange}
            accessibilityLabel={kcal.label}
          />
          <Text style={[Type.caption, { color: unitColor }]}>{kcal.unit}</Text>
        </View>
      </View>
      <View style={styles.rowWrap}>
        {macros.map((m) => (
          <View key={m.key} style={styles.cell}>
            <View style={styles.labelRow}>
              <View style={[styles.dot, { backgroundColor: m.color }]} />
              <Text style={[Type.caption, { color: labelColor }]}>{m.label}</Text>
            </View>
            <View style={[styles.inputWrap, wrapStyle]}>
              <TextInput
                style={[styles.input, { color: textColor }]}
                keyboardType="numeric"
                value={m.value}
                onChangeText={m.onChange}
                accessibilityLabel={m.label}
              />
              <Text style={[Type.caption, { color: unitColor }]}>{m.unit}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: Spacing.sm },
  rowWrap: { flexDirection: "row", gap: Spacing.sm },
  cell: { flex: 1 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.xs },
  dot: { width: 8, height: 8, borderRadius: Radius.sm },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: Spacing.xs,
  },
  input: { flex: 1, fontSize: 17, fontWeight: "700" },
  // Serif kcal hero — taller field, Newsreader numerals (the headline metric).
  kcalInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 56,
    gap: Spacing.xs,
  },
  kcalInput: { flex: 1, fontSize: 28, fontFamily: FontFamily.serifRegular },
});
