import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Sparkles } from "lucide-react-native";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { ConfidenceChip } from "@/components/ui/ConfidenceChip";
import {
  splitBodyIntoSegments,
  type ProgressCommentaryResult,
} from "@/lib/progressCommentary";

// Sloe Figma 492:2 — the THIS WEEK insight card sits on a soft LILAC
// (damson at ~12% alpha) wash with a hairline damson border. Mirrors web
// `PROGRESS_INSIGHT_LILAC_STYLE` (`--slot-dinner-soft` ≈ #6A4B7A12). The
// story-gate placeholder shares the exact same wash so the card never
// changes tone when the user crosses the 3-day data floor.
export const PROGRESS_INSIGHT_LILAC_BG = "rgba(106, 75, 122, 0.12)";
export const PROGRESS_INSIGHT_LILAC_BORDER = "rgba(106, 75, 122, 0.16)";

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
          // Sloe Figma 492:2 — lilac insight wash + hairline damson edge
          // (was cream `colors.card`). The frame's THIS WEEK card is lilac.
          backgroundColor: PROGRESS_INSIGHT_LILAC_BG,
          borderColor: PROGRESS_INSIGHT_LILAC_BORDER,
          borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
        },
        style,
      ]}
    >
      <View style={styles.eyebrowRow}>
        {/* Clay sparkle by the THIS WEEK eyebrow (frame). Mirrors web. */}
        <Sparkles size={14} color={accent.primary} strokeWidth={1.75} />
        <Text
          style={[
            Type.label,
            {
              color: accent.primary,
            },
          ]}
        >
          THIS WEEK
        </Text>
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
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 16,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  body: {
    // Per spec: body 12pt text-secondary inside the headline card.
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  chipRow: {
    marginTop: Spacing.sm,
    flexDirection: "row",
  },
});

export default ProgressHeadline;
