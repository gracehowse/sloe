import { Calendar, Lock, ShieldCheck } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  BARCODE_FREE_PAYWALL_CHIP,
  BARCODE_FREE_PAYWALL_CHIP_TEST_ID,
} from "@suppr/nutrition-core/barcodeFreePromise";
import {
  getPaywallTrustChips,
  PAYWALL_TRUST_SECURE_CHECKOUT,
  type PaywallTrustChip,
} from "@suppr/shared/landing/paywallTrust";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";

export type PaywallTrustStripProps = {
  chips: ReadonlyArray<PaywallTrustChip>;
  textSecondaryColor: string;
  /** Theme border for legacy pill chips (flag-off path). */
  borderColor: string;
  backgroundSecondaryColor: string;
  primaryColor: string;
  primarySoftColor: string;
};

/** Figma `284:2` trust row — inline · separators when flag on; pill chips when off. */
export function PaywallTrustStrip({
  chips,
  textSecondaryColor,
  borderColor,
  backgroundSecondaryColor,
  primaryColor,
  primarySoftColor,
}: PaywallTrustStripProps) {
  if (!chips.length) return null;

  const inline = isFeatureEnabled("paywall_trust_inline_v1");

  if (inline) {
    return (
      <View
        testID="paywall-trust-strip"
        style={styles.inlineRow}
        accessibilityRole="summary"
        accessibilityLabel={[
          PAYWALL_TRUST_SECURE_CHECKOUT.a11yLabel,
          ...chips.map((c) => c.a11yLabel),
          BARCODE_FREE_PAYWALL_CHIP.a11yLabel,
        ].join(". ")}
      >
        <InlineTrustItem
          icon={<Lock size={12} color={textSecondaryColor} strokeWidth={2.25} />}
          label={PAYWALL_TRUST_SECURE_CHECKOUT.label}
          a11yLabel={PAYWALL_TRUST_SECURE_CHECKOUT.a11yLabel}
          textColor={textSecondaryColor}
        />
        <Dot textColor={textSecondaryColor} />
        <InlineTrustItem
          icon={<Calendar size={12} color={textSecondaryColor} strokeWidth={2.25} />}
          label={chips[0]?.label ?? ""}
          a11yLabel={chips[0]?.a11yLabel ?? ""}
          textColor={textSecondaryColor}
        />
        {chips.slice(1).map((chip) => (
          <View key={chip.label} style={styles.inlineSegment}>
            <Dot textColor={textSecondaryColor} />
            <Text
              style={[styles.inlineText, { color: textSecondaryColor }]}
              accessibilityLabel={chip.a11yLabel}
            >
              {chip.label}
            </Text>
          </View>
        ))}
        <View style={styles.inlineSegment}>
          <Dot textColor={textSecondaryColor} />
          <View
            testID={BARCODE_FREE_PAYWALL_CHIP_TEST_ID}
            style={styles.inlineItem}
            accessibilityLabel={BARCODE_FREE_PAYWALL_CHIP.a11yLabel}
          >
            <ShieldCheck size={12} color={Accent.success} strokeWidth={2.25} />
            <Text style={[styles.inlineText, { color: textSecondaryColor }]}>
              {BARCODE_FREE_PAYWALL_CHIP.label}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      testID="paywall-trust-strip"
      style={styles.trustRow}
      accessibilityRole="summary"
      accessibilityLabel={`Trust commitments: ${chips.map((c) => c.a11yLabel).join(". ")}`}
    >
      <View
        testID={BARCODE_FREE_PAYWALL_CHIP_TEST_ID}
        style={[
          styles.trustChip,
          {
            borderColor: primaryColor,
            backgroundColor: primarySoftColor,
          },
        ]}
        accessibilityLabel={BARCODE_FREE_PAYWALL_CHIP.a11yLabel}
      >
        <ShieldCheck size={12} color={Accent.success} strokeWidth={2.25} />
        <Text style={[styles.trustChipText, { color: textSecondaryColor }]}>
          {BARCODE_FREE_PAYWALL_CHIP.label}
        </Text>
      </View>
      {chips.map((chip) => (
        <View
          key={chip.label}
          style={[
            styles.trustChip,
            {
              borderColor,
              backgroundColor: backgroundSecondaryColor,
            },
          ]}
          accessibilityLabel={chip.a11yLabel}
        >
          <ShieldCheck size={12} color={Accent.success} strokeWidth={2.25} />
          <Text style={[styles.trustChipText, { color: textSecondaryColor }]}>
            {chip.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function InlineTrustItem({
  icon,
  label,
  a11yLabel,
  textColor,
}: {
  icon: ReactNode;
  label: string;
  a11yLabel: string;
  textColor: string;
}) {
  return (
    <View style={styles.inlineItem} accessibilityLabel={a11yLabel}>
      {icon}
      <Text style={[styles.inlineText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function Dot({ textColor }: { textColor: string }) {
  return (
    <Text style={[styles.dot, { color: textColor }]} accessibilityElementsHidden importantForAccessibility="no">
      ·
    </Text>
  );
}

const styles = StyleSheet.create({
  trustRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  trustChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  trustChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  inlineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  inlineSegment: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  inlineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inlineText: {
    ...Type.caption,
    fontWeight: "600",
  },
  dot: {
    ...Type.caption,
    opacity: 0.7,
  },
});
