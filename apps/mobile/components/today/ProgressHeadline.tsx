import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { ConfidenceChip } from "@/components/ui/ConfidenceChip";
import {
  splitBodyIntoSegments,
  type ProgressCommentaryResult,
} from "@/lib/progressCommentary";

/**
 * Mobile `<ProgressHeadline>` — production design spec Surface E
 * "Progress hero (story-led)". Mirror of
 * `src/app/components/suppr/progress-headline.tsx`.
 *
 * Authority: D-2026-04-27-17 (Progress is a story not a stat-card
 * dashboard) + D-2026-04-27-12 (adaptive TDEE always-on, confidence
 * is metadata).
 *
 * Geometry: SupprCard 16pt radius, padding 20×14pt. Renders
 * eyebrow / headline / body with inline highlighted numerals + an
 * inline ConfidenceChip at the end of the body.
 */

export interface ProgressHeadlineProps {
  commentary: ProgressCommentaryResult;
  style?: ViewStyle;
  testID?: string;
}

export function ProgressHeadline({
  commentary,
  style,
  testID,
}: ProgressHeadlineProps) {
  const colors = useThemeColors();
  const cardElevation = useCardElevation();
  const segments = splitBodyIntoSegments(commentary.body, commentary.numerals);

  return (
    <View
      testID={testID ?? "progress-headline"}
      accessibilityRole="text"
      accessibilityLabel={`This week: ${commentary.headline}`}
      style={[
        styles.card,
        cardElevation.shadowStyle,
        {
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderColor: colors.cardBorder,
          // Sloe: hairline (≈1 physical px), not a 1pt (3px on @3x) boxed edge.
          borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
        },
        style,
      ]}
    >
      <Text
        style={[
          Type.label,
          {
            color: Accent.primary,
            marginBottom: 6,
          },
        ]}
      >
        THIS WEEK
      </Text>

      <Text
        style={[
          Type.headline,
          {
            color: colors.text,
            fontVariant: ["tabular-nums"],
          },
        ]}
        accessibilityRole="header"
      >
        {commentary.headline}
      </Text>

      <Text
        style={[
          styles.body,
          {
            color: colors.textSecondary,
          },
        ]}
      >
        {segments.map((seg, i) =>
          seg.highlight ? (
            <Text
              key={i}
              style={[
                {
                  fontVariant: ["tabular-nums"],
                  color: colors.text,
                  fontWeight: "600",
                },
              ]}
            >
              {seg.text}
            </Text>
          ) : (
            <React.Fragment key={i}>{seg.text}</React.Fragment>
          ),
        )}
      </Text>

      <View style={styles.chipRow}>
        <ConfidenceChip level={commentary.confidence} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 16,
  },
  body: {
    // Per spec: body 12pt text-secondary inside the headline card.
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  chipRow: {
    marginTop: 10,
    flexDirection: "row",
  },
});

export default ProgressHeadline;
