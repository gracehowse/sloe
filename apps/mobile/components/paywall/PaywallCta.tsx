import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { Accent, FontFamily, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Standalone primary CTA — Sloe Pro paywall (Figma `284:2`).
 *
 * The frame's "Start free 7-day trial →" clay pill. Extracted from the
 * old in-card CTA so the plan selector + trust row + CTA match the
 * frame's flat top-to-bottom layout (no big price card). All CTA STATE
 * LOGIC is owned by the screen and passed in — this component only
 * renders the pill. The label/colour/disabled/loading values are the
 * exact ones the screen computed for every state (Loading / Trial /
 * Subscribe / Open App Store), so no behaviour changed.
 *
 * `arrow` appends the frame's "→" affordance (trial state only).
 */
export function PaywallCta({
  label,
  color,
  disabled,
  loading,
  onPress,
  arrow = false,
  accessibilityLabel,
}: {
  label: string;
  color: string;
  disabled: boolean;
  loading: boolean;
  onPress: () => void;
  arrow?: boolean;
  /** ENG-716 — spoken override for VoiceOver. The visible `label` can carry a
   *  "/month" price suffix that reads as "slash month"; pass the natural-
   *  language form here (e.g. "Subscribe — £7.99 per month") without altering
   *  the visible text. Falls back to `label` when omitted. */
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      testID="paywall-cta"
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.cta,
        disabled ? { backgroundColor: colors.inputBg } : { backgroundColor: color },
        loading && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
    >
      {loading ? (
        <ActivityIndicator color={Accent.primaryForeground} />
      ) : (
        <Text style={[styles.label, disabled && { color: colors.textSecondary }]}>
          {label}
          {arrow ? "  →" : ""}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cta: {
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  label: {
    color: Accent.primaryForeground,
    fontFamily: FontFamily.sansBold,
    fontSize: 16,
  },
});
