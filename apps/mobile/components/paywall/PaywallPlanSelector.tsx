import { StyleSheet, Text, View, Pressable } from "react-native";

import { Accent, FontFamily, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Two-row plan selector — Sloe Pro paywall (Figma `284:2`).
 *
 * Renders the Annual / Monthly choice as two selectable rows (the
 * frame's plan selector), replacing the segmented Monthly/Annual
 * toggle. The Annual row carries the clay "BEST VALUE" badge + the
 * computed savings ("Save N%") + per-month math; the SELECTED row gets
 * a 2px clay border + filled clay radio. The Monthly row shows its
 * price plainly.
 *
 * CRITICAL — this is a presentation swap only. It drives the SAME
 * `billing` state the toggle did: `onSelect("annual" | "monthly")` is
 * wired to the screen's existing `onToggleBilling`, which fires
 * `paywall_period_changed` and updates `billing`. All downstream
 * logic — `trialApplies = billing === "annual"`, `currentProPkg`, the
 * CTA label/colour — is unchanged.
 *
 * Prices are the RESOLVED strings passed in by the screen (RC
 * `priceString`, or FALLBACK_PRICES during load). NEVER hardcoded —
 * Apple's storefront localisation (currency + VAT-inclusive display)
 * is preserved. The savings badge + per-month line are computed by the
 * screen from those same strings.
 *
 * When only one period is provisioned (`showMonthly` / `showAnnual`),
 * the screen hides the missing row — the lock-to-single-period logic
 * is preserved in the screen.
 */
export function PaywallPlanSelector({
  billing,
  onSelect,
  annualPriceString,
  monthlyPriceString,
  savingsBadge,
  annualPerMonthLine,
  showAnnual,
  showMonthly,
}: {
  billing: "monthly" | "annual";
  onSelect: (next: "monthly" | "annual") => void;
  /** Resolved annual price string (e.g. "£59.99"). */
  annualPriceString: string;
  /** Resolved monthly price string (e.g. "£7.99"). */
  monthlyPriceString: string;
  /** Computed "Save N%" badge — null suppresses it. */
  savingsBadge: string | null;
  /** Computed per-month line for the annual row (e.g. "just £5.00/mo").
   *  Null suppresses it. */
  annualPerMonthLine: string | null;
  showAnnual: boolean;
  showMonthly: boolean;
}) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the selected plan
  // (edge, fill, radio). Threaded into the module-level StyleSheet factory. The
  // recommended-plan badge keeps `Accent.success`.
  const accent = useAccent();
  const styles = makeStyles(colors, accent);

  return (
    <View style={styles.wrap} testID="paywall-plan-selector">
      {showAnnual ? (
        <PlanRow
          testID="paywall-plan-annual"
          selected={billing === "annual"}
          onPress={() => onSelect("annual")}
          title="Annual"
          subtitle={annualPerMonthLine}
          priceString={annualPriceString}
          periodSuffix="/yr"
          badge={savingsBadge}
          styles={styles}
          accessibilityLabel={`Annual plan, ${annualPriceString} per year${
            savingsBadge ? `, ${savingsBadge}, best value` : ""
          }`}
        />
      ) : null}
      {showMonthly ? (
        <PlanRow
          testID="paywall-plan-monthly"
          selected={billing === "monthly"}
          onPress={() => onSelect("monthly")}
          title="Monthly"
          subtitle={null}
          priceString={monthlyPriceString}
          periodSuffix="/mo"
          badge={null}
          styles={styles}
          accessibilityLabel={`Monthly plan, ${monthlyPriceString} per month`}
        />
      ) : null}
    </View>
  );
}

function PlanRow({
  testID,
  selected,
  onPress,
  title,
  subtitle,
  priceString,
  periodSuffix,
  badge,
  styles,
  accessibilityLabel,
}: {
  testID: string;
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle: string | null;
  priceString: string;
  periodSuffix: string;
  badge: string | null;
  styles: ReturnType<typeof makeStyles>;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.row, selected && styles.rowSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
    >
      {/* BEST VALUE badge — clay, rides the top edge of the annual row. */}
      {badge ? (
        <View style={styles.bestValue}>
          <Text style={styles.bestValueText}>BEST VALUE</Text>
        </View>
      ) : null}

      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>

      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {badge ? <Text style={styles.rowSavings}>{badge}</Text> : null}
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>

      <View style={styles.priceWrap}>
        <Text style={styles.price}>{priceString}</Text>
        <Text style={styles.pricePeriod}>{periodSuffix}</Text>
      </View>
    </Pressable>
  );
}

function makeStyles(
  colors: ReturnType<typeof useThemeColors>,
  accent: ReturnType<typeof useAccent>,
) {
  return StyleSheet.create({
    wrap: { gap: Spacing.md, marginBottom: Spacing.lg },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      borderRadius: Radius.xl * 2,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.lg,
    },
    // Selected — 2px aubergine ring + soft aubergine tint fill (Sloe
    // treatment system 2026-06-08, rule 7: plan-selector active → soft-tint).
    // The ring is the frame's selected-plan affordance; the soft tint brings
    // the active row in line with the onboarding `OptionCard` selected
    // treatment (tint + border) so "selected" reads identically across the
    // conversion surfaces. The fill stays reserved for the CTA + radio.
    rowSelected: {
      borderWidth: 2,
      borderColor: accent.primary,
      backgroundColor: accent.primarySoft,
    },
    bestValue: {
      position: "absolute",
      top: -10,
      left: Spacing.lg,
      backgroundColor: accent.primary,
      borderRadius: Radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    bestValueText: {
      fontFamily: FontFamily.sansBold,
      fontSize: 10,
      letterSpacing: 0.8,
      color: accent.primaryForeground,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: { borderColor: accent.primary },
    radioDot: {
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor: accent.primary,
    },
    rowText: { flex: 1 },
    rowTitle: { fontFamily: FontFamily.sansSemibold, fontSize: 16, color: colors.text },
    rowSavings: {
      fontFamily: FontFamily.sansSemibold,
      fontSize: 13,
      color: Accent.successSolid,
      marginTop: 1,
    },
    rowSubtitle: {
      fontFamily: FontFamily.sansRegular,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 1,
    },
    priceWrap: { flexDirection: "row", alignItems: "baseline" },
    // Plum Newsreader serif price numeral — matches the frame price.
    price: {
      fontFamily: FontFamily.serifRegular,
      fontSize: 22,
      color: colors.navPrimary,
      letterSpacing: -0.4,
    },
    pricePeriod: {
      fontFamily: FontFamily.sansRegular,
      fontSize: 13,
      color: colors.textSecondary,
      marginLeft: 2,
    },
  });
}
