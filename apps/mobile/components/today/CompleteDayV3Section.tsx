import React, { memo } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import {
  COMPLETE_DAY_V3_COPY,
  buildCompleteDayCoachQuote,
  completeDayTrendlinePoints,
  formatCompleteDayVsTarget,
} from "@suppr/shared/completeDayV3";

export interface CompleteDayV3SectionProps {
  dayLabel: string;
  eatenKcal: number;
  targetKcal: number;
  proteinG: number;
  proteinTargetG?: number;
  currentWeightKg: number;
  projectedWeightKg: number;
  projectionWeeks: number;
  textColor: string;
  textSecondaryColor: string;
  borderColor: string;
  cardColor: string;
}

function CompleteDayV3SectionImpl({
  dayLabel,
  eatenKcal,
  targetKcal,
  proteinG,
  proteinTargetG,
  currentWeightKg,
  projectedWeightKg,
  projectionWeeks,
  textColor,
  textSecondaryColor,
  borderColor,
  cardColor,
}: CompleteDayV3SectionProps) {
  const vsTarget = formatCompleteDayVsTarget(eatenKcal, targetKcal);
  const coach = buildCompleteDayCoachQuote({
    eatenKcal,
    targetKcal,
    proteinG,
    proteinTargetG,
  });
  const { baseline, projected, endY } = completeDayTrendlinePoints();

  const stats = [
    {
      value: Math.round(eatenKcal).toLocaleString(),
      label: COMPLETE_DAY_V3_COPY.statLabels.eaten,
      color: textColor,
    },
    {
      value: vsTarget.label,
      label: COMPLETE_DAY_V3_COPY.statLabels.vsTarget,
      color: vsTarget.tone === "under" ? Accent.successSolid : vsTarget.tone === "over" ? Accent.destructive : textColor,
    },
    {
      value: `${Math.round(proteinG)}g`,
      label: COMPLETE_DAY_V3_COPY.statLabels.protein,
      color: textColor,
    },
  ];

  return (
    <View style={{ width: "100%" }} testID="complete-day-v3">
      <Text style={{ ...Type.body, color: textSecondaryColor, lineHeight: 22, marginBottom: Spacing.md }}>
        {COMPLETE_DAY_V3_COPY.intro(dayLabel)}
      </Text>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: Spacing.md }} testID="complete-day-v3-stats">
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={{
              flex: 1,
              borderRadius: Radius.xl,
              borderWidth: 1,
              borderColor,
              backgroundColor: cardColor,
              paddingVertical: Spacing.md,
              paddingHorizontal: Spacing.sm,
              alignItems: "center",
            }}
          >
            <Text style={{ ...Type.headline, fontSize: 22, color: stat.color, fontVariant: ["tabular-nums"] }}>
              {stat.value}
            </Text>
            <Text
              style={{
                ...Type.label,
                color: textSecondaryColor,
                marginTop: Spacing.xs,
                textTransform: "uppercase",
              }}
            >
              {stat.label}
            </Text>
          </View>
        ))}
      </View>

      <View
        style={{
          borderRadius: Radius.xl,
          borderWidth: 1,
          borderColor,
          backgroundColor: cardColor,
          padding: Spacing.lg,
          marginBottom: Spacing.md,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.sm }}>
          <Text style={{ ...Type.label, color: textSecondaryColor, textTransform: "uppercase" }}>
            {COMPLETE_DAY_V3_COPY.projectionOverline}
          </Text>
          <Text style={{ ...Type.caption, color: textSecondaryColor }}>{COMPLETE_DAY_V3_COPY.projectionCaption}</Text>
        </View>
        <Svg width="100%" height={80} viewBox="0 0 300 80" preserveAspectRatio="none" testID="complete-day-v3-trendline">
          <Polyline points={baseline} fill="none" stroke={borderColor} strokeWidth={2} strokeDasharray="4 4" />
          <Polyline
            points={projected}
            fill="none"
            stroke={Accent.success}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={300} cy={endY} r={4} fill={Accent.success} />
        </Svg>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.xs }}>
          <Text style={{ ...Type.caption, color: textSecondaryColor, fontVariant: ["tabular-nums"] }}>
            {currentWeightKg} kg now
          </Text>
          <Text style={{ ...Type.caption, color: Accent.successSolid, fontVariant: ["tabular-nums"] }}>
            {projectedWeightKg} kg in {projectionWeeks} wks
          </Text>
        </View>
      </View>

      <Text
        style={{
          ...Type.body,
          fontStyle: "italic",
          fontWeight: "600",
          color: Accent.primary,
          textAlign: "center",
          paddingHorizontal: Spacing.sm,
        }}
        testID="complete-day-v3-coach"
      >
        &ldquo;{coach}&rdquo;
      </Text>
    </View>
  );
}

export const CompleteDayV3Section = memo(CompleteDayV3SectionImpl);

export default CompleteDayV3Section;
