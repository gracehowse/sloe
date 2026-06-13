/**
 * SupprButton — the shared CTA primitive (mobile).
 *
 * Implements the 2026-06-12 button-system grammar
 * (`docs/decisions/2026-06-12-button-system-solid-primary.md`): on the flat
 * cream surfaces the old aubergine-OUTLINE primaries and `colors.card`
 * beige-fill secondaries read as weak/floating/muddy. Two variants only:
 *
 *   - `primary` — SOLID aubergine fill (`accent.primarySolid` #3B2A4D), WHITE
 *     label, `Radius.full` pill, `Type.button` (sans-semibold). Solid fill IS the
 *     affordance — NO shadow (flat-card canon). Exactly ONE per screen (FAB +
 *     conversion paywalls excepted, per the one-CTA rule). Pressed feedback +
 *     haptic come from `PressableScale` (default `confirm` weight).
 *   - `ghost` — transparent, NO border, plum label (`accent.primarySolid`),
 *     same radius/padding. Replaces BOTH the old outline AND the beige
 *     `colors.card` fill secondary.
 *
 * Web mirror: `src/app/components/ui/button.tsx` (`variant="primary" | "ghost"`).
 *
 * Wraps `PressableScale` (which owns the scale + haptic micro-interaction) so
 * every CTA gets identical press feedback. Disabled reduces opacity + blocks
 * onPress; loading swaps the label for an ActivityIndicator + blocks onPress
 * (no double-submit, no silent commit).
 */
import * as React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import {
  PressableScale,
  type PressableScaleHaptic,
} from "./PressableScale";

export type SupprButtonVariant = "primary" | "ghost";

export interface SupprButtonProps {
  variant: SupprButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Convenience text label. Ignored if `children` is provided. */
  label?: string;
  children?: React.ReactNode;
  /** Layout override (e.g. `alignSelf`, `marginTop`). Never colour/shadow. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Press haptic weight. Default `confirm` (medium impact) per the grammar. */
  haptic?: PressableScaleHaptic;
  accessibilityLabel?: string;
}

export function SupprButton({
  variant,
  onPress,
  disabled = false,
  loading = false,
  label,
  children,
  style,
  testID,
  haptic = "confirm",
  accessibilityLabel,
}: SupprButtonProps) {
  const accent = useAccent();
  const isPrimary = variant === "primary";
  // Disabled OR loading both block the press (no double-submit).
  const blocked = disabled || loading;

  // Guard at call time rather than relying on the disabled prop reaching the
  // underlying Pressable — keeps the block robust across RN versions and in
  // synthetic test events.
  const handlePress = React.useCallback(() => {
    if (blocked) return;
    onPress?.();
  }, [blocked, onPress]);

  const labelColor = isPrimary ? "#fff" : accent.primarySolid;

  const containerStyle: ViewStyle = {
    backgroundColor: isPrimary ? accent.primarySolid : "transparent",
    // No border on either variant (ghost replaces the old outline) and no
    // shadow on either (flat-card canon — solid fill IS the affordance).
    // 0.65 floor (ENG-1011): 0.4 reads as 'broken/dead', 0.65 as 'not yet'.
    opacity: disabled ? 0.65 : 1,
  };

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      haptic={blocked ? "none" : haptic}
      onPress={handlePress}
      style={[styles.base, containerStyle, style]}
    >
      {loading ? (
        <ActivityIndicator
          testID={testID ? `${testID}-spinner` : undefined}
          color={labelColor}
        />
      ) : children ? (
        children
      ) : (
        <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    // paddingVertical Spacing.md (16) matches the nearest sibling CTA
    // (`TodayCompleteDayButton`) exactly — on-scale, clears the 44pt touch
    // target with the Type.button (sans-semibold 16) label.
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  label: {
    ...Type.button,
  },
});

export default SupprButton;
