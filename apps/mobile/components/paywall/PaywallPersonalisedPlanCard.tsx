import { StyleSheet, Text, View } from "react-native";

import { FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useMacroColors } from "@/lib/macroColors";
import {
  PAYWALL_PERSONALISED_PLAN_TEST_ID,
  type PersonalisedPlanPaywallSummary,
} from "@suppr/shared/paywall/personalisedPlanSummary";

/**
 * ENG-966 — recap card for onboarding-derived targets before the Pro pitch.
 */
export function PaywallPersonalisedPlanCard({
  summary,
}: {
  summary: PersonalisedPlanPaywallSummary;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const { colors: macro } = useMacroColors();

  return (
    <View
      testID={PAYWALL_PERSONALISED_PLAN_TEST_ID}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityRole="summary"
      accessibilityLabel={`${summary.heroTitle}. ${summary.calories} calories per day${summary.goalLabel ? `, ${summary.goalLabel}` : ""}.`}
    >
      <Text style={[Type.label, { color: accent.primarySolid }]}>{summary.eyebrow}</Text>
      <View style={styles.calRow}>
        <Text style={[styles.calories, { color: colors.text }]}>
          {summary.calories.toLocaleString()}
        </Text>
        <Text style={[styles.calUnit, { color: colors.textSecondary }]}>
          {summary.caloriesLabel}
        </Text>
      </View>
      {summary.goalLabel ? (
        <Text style={[styles.goal, { color: colors.textSecondary }]}>{summary.goalLabel}</Text>
      ) : null}
      {summary.proteinG != null ? (
        <Text style={[styles.protein, { color: macro.protein }]}>
          {summary.proteinG}g protein / day
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  calRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  calories: {
    fontFamily: FontFamily.serifSemibold,
    fontSize: 36,
    letterSpacing: -0.5,
  },
  calUnit: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
  },
  goal: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  protein: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    marginTop: Spacing.xs,
  },
});
