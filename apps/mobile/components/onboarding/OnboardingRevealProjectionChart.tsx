import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";

import { Accent, Spacing, Type } from "@/constants/theme";
import { SupprCard } from "@/components/ui/SupprCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { OnboardingRevealProjection } from "@suppr/shared/onboarding/revealProjection";

export interface OnboardingRevealProjectionChartProps {
  projection: OnboardingRevealProjection;
}

/**
 * ENG-1233 — projected weight trend on the onboarding Reveal step (mobile).
 * Mirror: `src/app/components/onboarding/OnboardingRevealProjectionChart.tsx`.
 */
export function OnboardingRevealProjectionChart({
  projection,
}: OnboardingRevealProjectionChartProps) {
  const colors = useThemeColors();
  const { startMarker, endMarker } = projection;
  const fmt = (kg: number) => `${kg.toFixed(1).replace(/\.0$/, "")} kg`;

  return (
    <SupprCard
      testID="onboarding-reveal-projection-chart"
      lift="soft"
      padding="none"
      style={styles.card}
      innerStyle={styles.cardInner}
    >
      <View style={styles.header}>
        <Text style={[Type.label, { color: colors.textTertiary }]}>PROJECTED TREND</Text>
        <Text style={[Type.caption, { color: colors.textTertiary, flexShrink: 1, textAlign: "right" }]}>
          ~{fmt(projection.endKg)} by{" "}
          <Text style={{ color: colors.text, fontWeight: "600" }}>{projection.dateLabel}</Text>
        </Text>
      </View>
      <Svg width="100%" height={86} viewBox="0 0 300 86" preserveAspectRatio="none">
        <Polyline
          points={projection.polylinePoints}
          fill="none"
          stroke={Accent.successSolid}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={startMarker.x} cy={startMarker.y} r={3.5} fill={colors.textTertiary} />
        <Circle cx={endMarker.x} cy={endMarker.y} r={4} fill={Accent.successSolid} />
      </Svg>
      <View style={styles.footer}>
        <Text style={[Type.caption, { color: colors.textTertiary }]}>{fmt(projection.startKg)} now</Text>
        <Text style={[Type.caption, { color: colors.textTertiary }]}>~{projection.weeks} weeks</Text>
      </View>
    </SupprCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.md },
  cardInner: { padding: Spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
});
