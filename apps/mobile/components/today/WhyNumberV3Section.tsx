import React, { memo } from "react";
import { Text, View } from "react-native";
import { Sparkles, TrendingDown } from "lucide-react-native";

import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { SupprButton } from "@/components/ui/SupprButton";
import {
  WHY_NUMBER_V3_COPY,
  buildWhyNumberResultSubtitle,
  formatWhyNumberHeroKcal,
  whyNumberCoachQuote,
  whyNumberConfidenceCard,
  whyNumberV3Rows,
} from "@suppr/shared/whyNumberV3";
import type { WhyThisNumberResult } from "@suppr/nutrition-core/whyThisNumber";

export interface WhyNumberV3SectionProps {
  targetCalories: number;
  result: WhyThisNumberResult;
  confidence: "low" | "medium" | "high" | null;
  loggingDays?: number | null;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  borderColor: string;
  cardColor: string;
  onKeepTarget?: () => void;
  onAdjustTarget?: () => void;
}

function SetIcPlate({
  children,
  highlight,
  borderColor,
  cardColor,
}: {
  children: React.ReactNode;
  highlight: boolean;
  borderColor: string;
  cardColor: string;
}) {
  const accent = useAccent();
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: Radius.lg,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: highlight ? accent.primary + "18" : cardColor,
        borderWidth: 1,
        borderColor: highlight ? accent.primary + "40" : borderColor,
      }}
    >
      {children}
    </View>
  );
}

function WhyNumberV3SectionImpl({
  targetCalories,
  result,
  confidence,
  loggingDays,
  textColor,
  textSecondaryColor,
  textTertiaryColor,
  borderColor,
  cardColor,
  onKeepTarget,
  onAdjustTarget,
}: WhyNumberV3SectionProps) {
  const accent = useAccent();
  const rows = whyNumberV3Rows(result);
  const confidenceCard = whyNumberConfidenceCard(confidence, loggingDays);

  return (
    <View style={{ gap: Spacing.lg }} testID="why-number-v3-section">
      <View style={{ alignItems: "center", gap: Spacing.xs, paddingVertical: Spacing.sm }}>
        <Text style={[Type.label, { color: textTertiaryColor }]}>{WHY_NUMBER_V3_COPY.heroOverline}</Text>
        <Text
          style={{
            fontSize: 40,
            fontFamily: Type.title.fontFamily,
            color: textColor,
            fontVariant: ["tabular-nums"],
            lineHeight: 44,
          }}
          testID="why-number-hero-kcal"
        >
          {formatWhyNumberHeroKcal(targetCalories)}
        </Text>
        <Text style={[Type.label, { color: textTertiaryColor, letterSpacing: 1.5 }]}>
          {WHY_NUMBER_V3_COPY.kcalPerDay}
        </Text>
      </View>

      <Text style={[Type.body, { color: textSecondaryColor, textAlign: "center", fontStyle: "italic", lineHeight: 20, paddingHorizontal: Spacing.sm }]}>
        {whyNumberCoachQuote(result.summary)}
      </Text>

      <Text style={[Type.label, { color: textTertiaryColor, paddingHorizontal: Spacing.xs }]}>
        {WHY_NUMBER_V3_COPY.sectionOverline}
      </Text>
      <View
        style={{
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor,
          backgroundColor: cardColor,
          overflow: "hidden",
        }}
      >
        {rows.map((row, index) => {
          const Icon = row.key === "tdee" ? Sparkles : TrendingDown;
          return (
            <View
              key={row.key}
              testID={`why-number-v3-row-${row.key}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: Spacing.md,
                paddingHorizontal: Spacing.lg,
                paddingVertical: Spacing.md,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: borderColor,
                backgroundColor: row.highlight ? accent.primary + "0D" : cardColor,
              }}
            >
              <SetIcPlate highlight={row.highlight} borderColor={borderColor} cardColor={cardColor}>
                <Icon size={17} color={row.highlight ? accent.primary : textSecondaryColor} />
              </SetIcPlate>
              <View style={{ flex: 1 }}>
                <Text style={[Type.body, { color: textColor, fontWeight: "600" }]}>{row.title}</Text>
                <Text style={[Type.caption, { color: textSecondaryColor }]}>{row.subtitle}</Text>
              </View>
              <Text style={[Type.body, { color: textColor, fontWeight: "600", fontVariant: ["tabular-nums"] }]}>
                {row.value}
              </Text>
            </View>
          );
        })}
      </View>

      <View
        testID="why-number-result-card"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.md,
          backgroundColor: accent.primary,
          borderRadius: Radius.xl,
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.lg,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: accent.primaryForeground }}>
            {WHY_NUMBER_V3_COPY.yourTarget}
          </Text>
          <Text style={{ fontSize: 12, color: accent.primaryForeground, opacity: 0.8, marginTop: 2 }}>
            {buildWhyNumberResultSubtitle(result.lines)}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 34,
            fontFamily: Type.title.fontFamily,
            color: accent.primaryForeground,
            fontVariant: ["tabular-nums"],
          }}
        >
          {formatWhyNumberHeroKcal(targetCalories)}
        </Text>
      </View>

      {confidenceCard ? (
        <View
          style={{
            flexDirection: "row",
            gap: Spacing.md,
            borderRadius: Radius.lg,
            borderWidth: 1,
            borderColor,
            backgroundColor: cardColor,
            padding: Spacing.lg,
          }}
        >
          <SetIcPlate highlight={false} borderColor={borderColor} cardColor={cardColor}>
            <Sparkles size={17} color={textSecondaryColor} />
          </SetIcPlate>
          <View style={{ flex: 1 }}>
            <Text style={[Type.body, { color: textColor, fontWeight: "600" }]}>{confidenceCard.title}</Text>
            <Text style={[Type.caption, { color: textSecondaryColor, lineHeight: 18, marginTop: 2 }]}>
              {confidenceCard.body}
            </Text>
          </View>
        </View>
      ) : null}

      {onKeepTarget ? (
        <SupprButton variant="primary" onPress={onKeepTarget} testID="why-number-keep-target">
          {WHY_NUMBER_V3_COPY.keepThisTarget}
        </SupprButton>
      ) : null}
      {onAdjustTarget ? (
        <SupprButton variant="ghost" onPress={onAdjustTarget} testID="why-this-number-adjust-target">
          {WHY_NUMBER_V3_COPY.adjustPace}
        </SupprButton>
      ) : null}
    </View>
  );
}

export const WhyNumberV3Section = memo(WhyNumberV3SectionImpl);
