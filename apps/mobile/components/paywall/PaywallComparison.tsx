import { StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { Accent, FontFamily, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  PAYWALL_COMPARISON_ROWS,
  type PaywallComparisonRow,
} from "@suppr/shared/landing/paywallValueProps";

/**
 * FREE / PRO comparison matrix — Sloe Pro paywall (Figma `284:2`).
 *
 * Two columns (FREE / PRO) with the PRO column lilac-highlighted (the
 * `Accent.info` damson-lilac from the locked palette, ~8% wash). Rows
 * show ✓ / — from the shared `PAYWALL_COMPARISON_ROWS` SSOT (web ==
 * mobile).
 *
 * Framing is deliberate: both shared rows show ✓ in BOTH columns (Free
 * is genuinely useful); the two Pro-only rows show — / ✓. Reads as
 * "Pro expands Free", not "Free is crippled" — permission-not-
 * restriction positioning. See `docs/ux/redesign/paywall.md` §3a.
 */
// Damson-lilac wash for the PRO column (mirrors web --accent-info-soft).
// Accent.win (#6A4B7A = rgb(106,75,122)) @ ~8% via the alpha-suffix pattern.
const PRO_COLUMN_WASH = Accent.win + "14";

function Cell({
  value,
  styles,
  colors,
}: {
  value: PaywallComparisonRow["free"];
  styles: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof useThemeColors>;
}) {
  if (value === true) {
    return (
      <Check
        size={16}
        color={Accent.successSolid}
        strokeWidth={2.25}
        accessibilityLabel="Included"
      />
    );
  }
  if (value === false) {
    return (
      <Text style={styles.dash} accessibilityLabel="Not included">
        —
      </Text>
    );
  }
  return <Text style={[styles.cellValue, { color: colors.text }]}>{value}</Text>;
}

export function PaywallComparison() {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <View style={styles.wrap} testID="paywall-comparison">
      {/* Header row — FREE / PRO column labels. */}
      <View style={styles.headerRow}>
        <View style={styles.labelCol} />
        <View style={styles.valueCol}>
          <Text style={styles.colHeadFree}>FREE</Text>
        </View>
        <View style={[styles.valueCol, styles.proCol]}>
          <Text style={styles.colHeadPro}>PRO</Text>
        </View>
      </View>

      {PAYWALL_COMPARISON_ROWS.map((row) => (
        <View
          key={row.key}
          testID={`paywall-comparison-${row.key}`}
          style={styles.row}
        >
          <View style={styles.labelCol}>
            <Text style={styles.rowLabel}>{row.label}</Text>
          </View>
          <View style={styles.valueCol}>
            <Cell value={row.free} styles={styles} colors={colors} />
          </View>
          <View style={[styles.valueCol, styles.proCol]}>
            <Cell value={row.pro} styles={styles} colors={colors} />
          </View>
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    wrap: {
      borderRadius: Radius.xl * 2,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
      overflow: "hidden",
      marginBottom: Spacing.lg,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    labelCol: { flex: 1, paddingLeft: Spacing.lg, paddingRight: Spacing.sm },
    valueCol: { width: 64, alignItems: "center", justifyContent: "center" },
    // Lilac PRO column band — header + every row cell share the wash so
    // the recommended column reads as one continuous strip.
    proCol: { backgroundColor: PRO_COLUMN_WASH, alignSelf: "stretch" },
    rowLabel: { fontFamily: FontFamily.sansMedium, fontSize: 14, color: colors.text },
    colHeadFree: {
      fontFamily: FontFamily.sansBold,
      fontSize: 11,
      letterSpacing: 0.6,
      color: colors.textSecondary,
    },
    colHeadPro: {
      fontFamily: FontFamily.sansBold,
      fontSize: 11,
      letterSpacing: 0.6,
      color: Accent.info,
    },
    dash: { fontSize: 15, color: colors.textSecondary },
    cellValue: { fontFamily: FontFamily.sansSemibold, fontSize: 14 },
  });
}
