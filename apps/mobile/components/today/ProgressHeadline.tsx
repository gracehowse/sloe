import { memo } from "react";
import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Sparkles } from "lucide-react-native";
import { IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useCardElevation } from "@/hooks/useCardElevation";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
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

function ProgressHeadlineImpl({
  commentary,
  style,
  testID,
}: ProgressHeadlineProps) {
  const colors = useThemeColors();
  const cardElevation = useCardElevation({ variant: "soft" });
  const accent = useAccent();
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
          // ENG-1081 — card-fill cohesion (Grace 2026-06-13): white slab so the
          // insight card matches its white siblings (the ✦ + THIS WEEK eyebrow +
          // serif headline carry the insight role). Was flag-gated; collapsed in
          // ENG-1356 (the always-on flag never rendered the legacy lilac wash).
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderColor: colors.cardBorder,
          borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
        },
        style,
      ]}
    >
      <View style={styles.eyebrowRow}>
        {/* headers census 2026-06-10: sparkle-eyebrow row → IconSize.xs + the
            AA-safe accent.primarySolid (was size 14 + accent.primary). */}
        <Sparkles size={IconSize.xs} color={accent.primarySolid} strokeWidth={1.75} />
        <Text style={[Type.label, { color: accent.primarySolid }]}>THIS WEEK</Text>
      </View>

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
    borderRadius: CARD_RADIUS,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    // headers census 2026-06-10: sparkle-eyebrow gap → Spacing.xs (4).
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  body: {
    // Per spec: body 12pt text-secondary inside the headline card.
    ...Type.captionSmall,
    lineHeight: 18,
    marginTop: 8,
  },
  chipRow: {
    marginTop: Spacing.sm,
    flexDirection: "row",
  },
});

export const ProgressHeadline = memo(ProgressHeadlineImpl);

export default ProgressHeadline;
