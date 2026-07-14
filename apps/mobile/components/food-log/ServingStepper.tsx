import * as React from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Minus, Plus } from "lucide-react-native";

import { withAlpha, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * F-137 (Grace TF feedback, 2026-05-11) — inline serving stepper.
 *
 * Replaces the free-text grams TextInput on the barcode result with a
 * `[−] [value] [+]` stepper so users don't have to math servings × grams.
 * The TextInput stays in the middle for direct entry (long entries like
 * "112.5g" still work); the buttons just nudge ±step.
 *
 * Used by:
 *   - `apps/mobile/components/BarcodeScannerModal.tsx` (Log sheet barcode result)
 *   - `apps/mobile/app/(tabs)/barcode.tsx` (standalone barcode page)
 *
 * Other food-log surfaces (FoodSearchPanel, recipe ingredient pickers) keep
 * their existing UIs; this is specifically for the barcode-result amount
 * picker where the ergonomics complaint surfaced.
 */
export interface ServingStepperProps {
  /** Current numeric value as a string (kept as string so TextInput stays controlled). */
  value: string;
  /** Setter — receives a numeric string. */
  onChange: (next: string) => void;
  /** Step size per `+`/`−` tap. e.g. `0.5` for servings, `5` for grams. */
  step: number;
  /**
   * Label rendered to the right of the input. Switches singular/plural
   * automatically when `unit` is given as `{ singular, plural }`. Pass
   * a single string when you don't want pluralisation (e.g. "g").
   */
  unit: string | { singular: string; plural: string };
  /** Minimum (clamped). Default 0 for grams; pass 0.5 for servings. */
  min?: number;
  /** Maximum (clamped). Default 10000. */
  max?: number;
  /** Accessibility label for the numeric input (e.g. "Number of servings"). */
  inputAccessibilityLabel?: string;
  /** Optional wrapping style. */
  style?: StyleProp<ViewStyle>;
  /** testID prefix for the buttons + input (e.g. `barcode-amount`). */
  testIdPrefix?: string;
}

export function ServingStepper({
  value,
  onChange,
  step,
  unit,
  min = 0,
  max = 10000,
  inputAccessibilityLabel,
  style,
  testIdPrefix,
}: ServingStepperProps) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the +/- button tint.
  // Lifted from the module-level StyleSheet (which can't read a hook) onto the
  // inline button style — the `TodayPlannedMealsCard` StyleSheet-lift pattern.
  const accent = useAccent();
  const btnTint = { backgroundColor: withAlpha(accent.primary, 0x1A) };

  const parsed = React.useMemo(() => {
    const n = Number.parseFloat(String(value).replace(",", ".").trim());
    if (!Number.isFinite(n)) return null;
    return n;
  }, [value]);

  const clamp = React.useCallback(
    (n: number) => {
      const clamped = Math.max(min, Math.min(max, n));
      // Round to 1 dp so 1 + 0.5 doesn't accumulate floating-point cruft.
      return Math.round(clamped * 10) / 10;
    },
    [min, max],
  );

  const handleDecrement = React.useCallback(() => {
    const base = parsed ?? min;
    onChange(String(clamp(base - step)));
  }, [parsed, min, step, clamp, onChange]);

  const handleIncrement = React.useCallback(() => {
    const base = parsed ?? min;
    onChange(String(clamp(base + step)));
  }, [parsed, min, step, clamp, onChange]);

  const displayUnit = React.useMemo(() => {
    if (typeof unit === "string") return unit;
    const n = parsed ?? 0;
    return n === 1 ? unit.singular : unit.plural;
  }, [unit, parsed]);

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.inputBg, borderColor: colors.border },
        style,
      ]}
      testID={testIdPrefix ? `${testIdPrefix}-stepper` : undefined}
    >
      <Pressable
        onPress={handleDecrement}
        accessibilityRole="button"
        accessibilityLabel="Decrease amount"
        hitSlop={8}
        style={({ pressed }) => [
          styles.btn,
          btnTint,
          { opacity: pressed ? 0.6 : 1 },
          (parsed ?? min) <= min && { opacity: 0.35 },
        ]}
        disabled={(parsed ?? min) <= min}
        testID={testIdPrefix ? `${testIdPrefix}-decrement` : undefined}
      >
        <Minus size={18} color={colors.text} strokeWidth={2.25} />
      </Pressable>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        accessibilityLabel={inputAccessibilityLabel}
        style={[styles.input, { color: colors.text }]}
        testID={testIdPrefix ? `${testIdPrefix}-input` : undefined}
      />
      <Text style={[styles.unit, { color: colors.textSecondary }]}>{displayUnit}</Text>
      <Pressable
        onPress={handleIncrement}
        accessibilityRole="button"
        accessibilityLabel="Increase amount"
        hitSlop={8}
        style={({ pressed }) => [
          styles.btn,
          btnTint,
          { opacity: pressed ? 0.6 : 1 },
          (parsed ?? min) >= max && { opacity: 0.35 },
        ]}
        disabled={(parsed ?? min) >= max}
        testID={testIdPrefix ? `${testIdPrefix}-increment` : undefined}
      >
        <Plus size={18} color={colors.text} strokeWidth={2.25} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    gap: Spacing.xs,
  },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    // backgroundColor lifted to an inline `btnTint` (flag-aware accent) — see
    // the component body. Module-level styles can't read `useAccent()`.
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minWidth: 48,
    textAlign: "center",
    ...Type.headline,
    paddingVertical: 4,
  },
  unit: {
    ...Type.body,
    minWidth: 56,
  },
});
