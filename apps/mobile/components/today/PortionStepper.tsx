import React, { memo, useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { StepperCircleButton } from "@/components/ui/StepperCircleButton";
import { IconSize, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
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

function PortionStepperImpl({
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
  // Secondary accent (Frost flag → damson, else clay) for the active chip.
  const accent = useAccent();

  // Re-sync the buffer whenever the canonical value changes (± / chip /
  // external reset) so the field always reflects the committed state.
  useEffect(() => {
    setText(formatMultiplier(value));
  }, [value]);

  const commit = (raw: number) => onChange(clampPortion(raw, min, max));

  return (
    <>
      <View style={s.stepperRow}>
        <StepperCircleButton
          onPress={() => commit(value - step)}
          accessibilityLabel="Decrease portion"
          testID={`${testIDPrefix}-minus`}
          size="lg"
          bordered
        >
          <Minus size={IconSize.base} color={colors.text} strokeWidth={2.25} />
        </StepperCircleButton>
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
        <StepperCircleButton
          onPress={() => commit(value + step)}
          accessibilityLabel="Increase portion"
          testID={`${testIDPrefix}-plus`}
          size="lg"
          bordered
        >
          <Plus size={IconSize.base} color={colors.text} strokeWidth={2.25} />
        </StepperCircleButton>
      </View>
      <View style={s.chipRow}>
        {chips.map((chip) => {
          const active = Math.abs(value - chip) < 0.001;
          return (
            <PressableScale
              key={chip}
              onPress={() => commit(chip)}
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={`Set portion to ${chip} times`}
              testID={`${testIDPrefix}-chip-${chip}`}
              style={[
                s.chip,
                {
                  // §7 (2026-06-10): tint IS the signal — no accent ring.
                  borderColor: active ? accent.primarySoft : colors.border,
                  backgroundColor: active ? accent.primarySoft : "transparent",
                },
              ]}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: active ? colors.text : colors.textSecondary }}>
                {formatMultiplier(chip)}×
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  stepperRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  stepValue: { flex: 1, height: 44, borderWidth: 1, borderRadius: Radius.md, fontSize: 16, fontWeight: "700" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.sm },
  // Chips census (2026-06-10): §7 family — fully round, hairline.
  chip: { paddingHorizontal: Spacing.dense, paddingVertical: 8, borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth },
});

export const PortionStepper = memo(PortionStepperImpl);

export default PortionStepper;
