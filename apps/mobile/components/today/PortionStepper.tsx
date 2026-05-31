import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { Accent, IconSize, Radius, Spacing } from "@/constants/theme";
import type { ThemeColors } from "@/hooks/use-theme-colors";

/**
 * PortionStepper — shared portion-multiplier control (ENG-783).
 *
 * One control, two surfaces: the edit-entry sheet (`EditEntryV2`) and the
 * saved-meal portion-confirm sheet (`SavedMealPortionSheet`). −/numeric/+
 * stepper with quick chips, clamped to [min, max] and stepped by `step`.
 * Keeps a local text buffer so free typing ("1." mid-entry) doesn't fight
 * the clamp; commits on blur and on every ± / chip tap.
 *
 * Pure-number contract: the parent owns the canonical multiplier and is
 * told the new value via `onChange`. The parent decides what that means
 * (recompute macros, rescale a saved meal, etc.).
 */
export const PORTION_MIN = 0.125;
export const PORTION_MAX = 24;
export const PORTION_STEP = 0.25;
export const PORTION_CHIPS = [0.5, 0.75, 1, 1.5, 2] as const;

export function clampPortion(n: number, min = PORTION_MIN, max = PORTION_MAX): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(min, Math.min(max, n));
}

export function formatMultiplier(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export interface PortionStepperProps {
  value: number;
  onChange: (next: number) => void;
  colors: ThemeColors;
  min?: number;
  max?: number;
  step?: number;
  chips?: readonly number[];
  testIDPrefix?: string;
}

export function PortionStepper({
  value,
  onChange,
  colors,
  min = PORTION_MIN,
  max = PORTION_MAX,
  step = PORTION_STEP,
  chips = PORTION_CHIPS,
  testIDPrefix = "portion",
}: PortionStepperProps) {
  const [text, setText] = useState(formatMultiplier(value));

  // Re-sync the buffer whenever the canonical value changes (± / chip /
  // external reset) so the field always reflects the committed state.
  useEffect(() => {
    setText(formatMultiplier(value));
  }, [value]);

  const commit = (raw: number) => onChange(clampPortion(raw, min, max));

  return (
    <>
      <View style={s.stepperRow}>
        <Pressable
          onPress={() => commit(value - step)}
          accessibilityRole="button"
          accessibilityLabel="Decrease portion"
          testID={`${testIDPrefix}-minus`}
          style={[s.stepBtn, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
        >
          <Minus size={IconSize.base} color={colors.text} strokeWidth={2.25} />
        </Pressable>
        <TextInput
          style={[s.stepValue, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
          keyboardType="decimal-pad"
          value={text}
          onChangeText={setText}
          onBlur={() => commit(parseFloat(text.replace(",", ".")) || 1)}
          textAlign="center"
          accessibilityLabel="Portion multiplier"
          testID={`${testIDPrefix}-input`}
        />
        <Pressable
          onPress={() => commit(value + step)}
          accessibilityRole="button"
          accessibilityLabel="Increase portion"
          testID={`${testIDPrefix}-plus`}
          style={[s.stepBtn, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
        >
          <Plus size={IconSize.base} color={colors.text} strokeWidth={2.25} />
        </Pressable>
      </View>
      <View style={s.chipRow}>
        {chips.map((chip) => {
          const active = Math.abs(value - chip) < 0.001;
          return (
            <Pressable
              key={chip}
              onPress={() => commit(chip)}
              accessibilityRole="button"
              accessibilityLabel={`Set portion to ${chip} times`}
              testID={`${testIDPrefix}-chip-${chip}`}
              style={[
                s.chip,
                {
                  borderColor: active ? Accent.primary : colors.border,
                  backgroundColor: active ? Accent.primarySoft : "transparent",
                },
              ]}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: active ? colors.text : colors.textSecondary }}>
                {formatMultiplier(chip)}×
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  stepperRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  stepBtn: { width: 44, height: 44, borderRadius: Radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepValue: { flex: 1, height: 44, borderWidth: 1, borderRadius: Radius.md, fontSize: 16, fontWeight: "700" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1 },
});

export default PortionStepper;
