import { StyleSheet, Text, View } from "react-native";

import { Accent, FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { PAYWALL_NO_PAYMENT_DUE_CHIP } from "@suppr/shared/landing/paywallTrust";

/**
 * ENG-970 — surfaces existing trial disclosure one level up (Cal AI parity).
 * Renders only when `trialApplies === true`; the screen owns that guard.
 */
export function PaywallNoPaymentChip() {
  return (
    <View
      testID={PAYWALL_NO_PAYMENT_DUE_CHIP.testId}
      style={styles.chip}
      accessibilityRole="text"
      accessibilityLabel={PAYWALL_NO_PAYMENT_DUE_CHIP.a11yLabel}
    >
      <Text style={styles.label}>{PAYWALL_NO_PAYMENT_DUE_CHIP.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "center",
    backgroundColor: `${Accent.success}14`,
    borderColor: `${Accent.success}4D`,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  label: {
    color: Accent.successSolid,
    ...Type.captionSmall,
    textAlign: "center",
  },
});
