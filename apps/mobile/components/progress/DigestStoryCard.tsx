import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Accent, FontFamily, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { SupprCard } from "@/components/ui/SupprCard";
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
  // Secondary accent (Frost flag → damson, else clay) for the story-link tint.
  // Win/positive beats keep `Accent.success`; misses keep `Accent.destructive`.
  const accent = useAccent();
  const story = buildDigestStory(input);

  // Empty state: zero days logged. Render the card but with a calm,
  // factual fallback. No emoji, no exhortation.
  const isEmpty = input.daysLogged <= 0;

  return (
    // Card chrome is the shared <SupprCard> shell (Grace 2026-06-04).
    <SupprCard
      testID={testID ?? "digest-story-card"}
      accessibilityLabel={
        isEmpty
          ? "Week digest. Quiet week — log a meal to start your story."
          : `Week digest. ${story.paragraph}`
      }
      padding="none"
      style={style}
      innerStyle={styles.cardInner}
    >
      <View style={styles.headerRow}>
        <Text
          style={[
            Type.label,
            {
              // Sloe treatment: small accent label reads in the AA-safe
              // primarySolid aubergine on light (matches "Daily Calories").
              color: accent.primarySolid,
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
        // 2026-05-23 — was a stack of 5 prose sentences (text wall).
        // Restructured into:
        //   1. Hero row: big "X/7 days logged" + calorie-delta pill
        //   2. One compact supporting stat line (avg kcal + protein hits)
        //   3. Insight prose (closest day + dow pattern, combined)
        // Same data, real visual hierarchy.
        (() => {
          const daysLogged = Math.max(0, Math.floor(input.daysLogged));
          const target = input.targetCalories ?? 0;
          const avg = input.avgCalories ?? 0;
          const deltaKcal = avg && target ? Math.round(avg - target) : null;
          // Delta pill colour follows the calorie-ring rule
          // (`feedback_calorie_ring_colour_mapping.md`): under → green,
          // over → red; tiny tolerance for "on target".
          const deltaTone =
            deltaKcal == null
              ? null
              : Math.abs(deltaKcal) <= Math.max(40, target * 0.04)
                ? "neutral"
                : deltaKcal > 0
                  ? "over"
                  : "under";
          const deltaLabel =
            deltaKcal == null
              ? null
              : deltaTone === "neutral"
                ? "On target"
                : deltaTone === "over"
                  ? `+${deltaKcal.toLocaleString()} over`
                  : `${Math.abs(deltaKcal).toLocaleString()} under`;
          const deltaBg =
            deltaTone === "over"
              ? Accent.destructive + "1a"
              : deltaTone === "under"
                ? Accent.success + "1f"
                : colors.border;
          const deltaFg =
            deltaTone === "over"
              ? Accent.destructive
              : deltaTone === "under"
                ? Accent.success
                : colors.textSecondary;

          // Supporting stat — compress avg + protein into one line.
          const supportParts: string[] = [];
          if (avg && target) {
            supportParts.push(`Avg ${Math.round(avg).toLocaleString()} kcal`);
          }
          if (
            input.proteinOnTargetDays != null &&
            daysLogged > 0
          ) {
            supportParts.push(
              `Protein ${input.proteinOnTargetDays}/${daysLogged} days`,
            );
          }
          const supportLine = supportParts.join(" · ");

          // Insight prose — collapse closest + dow pattern into a
          // single quiet line. Only render when at least one is set.
          const insightParts: string[] = [];
          if (story.closestLine) insightParts.push(story.closestLine);
          if (story.dayOfWeekPatternLine) insightParts.push(story.dayOfWeekPatternLine);
          const insight = insightParts.join(" ");

          return (
            <View style={{ marginTop: 12 }}>
              <View style={styles.heroRow} testID="digest-hero-row">
                {/* SLOE Phase 0: the days-logged hero numeral reads in
                    Newsreader serif (family carries the weight; the small `/7`
                    denominator stays sans). */}
                <Text
                  style={{
                    fontFamily: FontFamily.serifRegular,
                    fontSize: 30,
                    color: colors.text,
                    fontVariant: ["tabular-nums"],
                    letterSpacing: -0.6,
                  }}
                >
                  {daysLogged}
                  <Text style={{ fontFamily: FontFamily.sansSemibold, fontSize: 18, color: colors.textTertiary, fontWeight: "600" }}>
                    /7
                  </Text>
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    marginLeft: 8,
                    flex: 1,
                  }}
                >
                  days logged
                </Text>
                {deltaLabel ? (
                  <View
                    testID="digest-delta-pill"
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: deltaBg,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: deltaFg,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {deltaLabel}
                    </Text>
                  </View>
                ) : null}
              </View>

              {supportLine ? (
                <Text
                  testID="digest-support-line"
                  style={[
                    styles.body,
                    { color: colors.textSecondary, marginTop: 6 },
                  ]}
                >
                  {supportLine}
                </Text>
              ) : null}

              {insight ? (
                <Text
                  testID="digest-insight-line"
                  style={[
                    styles.body,
                    {
                      color: colors.textTertiary,
                      marginTop: 10,
                      fontStyle: "italic",
                    },
                  ]}
                >
                  {insight}
                </Text>
              ) : null}
            </View>
          );
        })()
      )}
    </SupprCard>
  );
}

const styles = StyleSheet.create({
  // Chrome (radius/border/fill/lift) is the <SupprCard> shell; this only
  // carries the card's asymmetric content padding.
  cardInner: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
  },
});

export default DigestStoryCard;
