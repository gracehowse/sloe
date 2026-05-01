import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Accent, Elevation, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { buildDigestStory, type DigestStoryInput } from "@/lib/digestStory";

/**
 * `<DigestStoryCard>` — always-visible weekly narrative card on
 * Progress. Replaces the 2x2 stat-card grid as the visual lead.
 *
 * Authority: D-2026-04-27-17 (Progress is a story, not a stat-card
 * dashboard) + customer-lens audit 2026-04-30 (the 2x2 grid still
 * anchors visually after the Phase 4 refactor — promote a narrative
 * card above it).
 *
 * Distinct from:
 *   - `<ProgressHeadline>` — engine-led adaptive-TDEE recap line
 *     (different cadence, requires confidence ≥ medium).
 *   - `<Digest>` — Sunday-evening recap card with share + dismiss
 *     (only renders Sat 18:00 → Tue, dismissible per week).
 *
 * `<DigestStoryCard>` renders any time `state !== "empty"`. Empty
 * state is inert (no numbers, no claims) so it can sit at the top of
 * a week-1 user's Progress without lying.
 *
 * Mirror: `src/app/components/suppr/digest-story-card.tsx`.
 */

export interface DigestStoryCardProps extends DigestStoryInput {
  style?: ViewStyle;
  testID?: string;
}

export function DigestStoryCard(props: DigestStoryCardProps) {
  const { style, testID, ...input } = props;
  const colors = useThemeColors();
  const story = buildDigestStory(input);

  // Empty state: zero days logged. Render the card but with a calm,
  // factual fallback. No emoji, no exhortation.
  const isEmpty = input.daysLogged <= 0;

  return (
    <View
      testID={testID ?? "digest-story-card"}
      accessibilityRole="text"
      accessibilityLabel={
        isEmpty
          ? "Week digest. Quiet week — log a meal to start your story."
          : `Week digest. ${story.paragraph}`
      }
      style={[
        styles.card,
        Elevation.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
        },
        style,
      ]}
    >
      <View style={styles.headerRow}>
        <Text
          style={[
            Type.label,
            {
              color: Accent.primary,
            },
          ]}
        >
          WEEK DIGEST
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: colors.textTertiary,
            fontVariant: ["tabular-nums"],
          }}
        >
          {input.weekLabel}
        </Text>
      </View>

      {isEmpty ? (
        <Text
          testID="digest-story-card-empty"
          style={[styles.body, { color: colors.textSecondary, marginTop: 10 }]}
        >
          Quiet week — log a meal to start your story.
        </Text>
      ) : (
        <View style={{ marginTop: 10, gap: 6 }}>
          <Text
            testID="digest-story-days-line"
            style={[styles.body, { color: colors.text, fontWeight: "600" }]}
          >
            {story.daysLine}
          </Text>
          {story.caloriesLine ? (
            <Text
              testID="digest-story-calories-line"
              style={[styles.body, { color: colors.textSecondary }]}
            >
              {story.caloriesLine}
            </Text>
          ) : null}
          {story.proteinLine ? (
            <Text
              testID="digest-story-protein-line"
              style={[styles.body, { color: colors.textSecondary }]}
            >
              {story.proteinLine}
            </Text>
          ) : null}
          {story.closestLine ? (
            <Text
              testID="digest-story-closest-line"
              style={[styles.body, { color: colors.textSecondary }]}
            >
              {story.closestLine}
            </Text>
          ) : null}
          {story.dayOfWeekPatternLine ? (
            <Text
              testID="digest-story-dow-pattern-line"
              style={[styles.body, { color: colors.textSecondary }]}
            >
              {story.dayOfWeekPatternLine}
            </Text>
          ) : null}
        </View>
      )}
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
  },
});

export default DigestStoryCard;
