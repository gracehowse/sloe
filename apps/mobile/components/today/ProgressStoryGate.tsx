import { memo } from "react";
import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Accent, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  buildProgressStoryPlaceholder,
  STORY_DATA_FLOOR_DAYS,
} from "@/lib/progressStoryGate";

/**
 * `<ProgressStoryGate>` — placeholder card rendered in place of the
 * engine-led `<ProgressHeadline>` when the user has fewer than
 * `STORY_DATA_FLOOR_DAYS` (=3) days of logging.
 *
 * Authority: customer-lens audit 2026-04-30 + D-2026-04-27-17.
 *
 * Geometry mirrors `<ProgressHeadline>` so the card slot doesn't jump
 * when the user crosses the threshold and the live story unlocks.
 *
 * Mirror: `src/app/components/suppr/progress-story-gate.tsx`.
 */

export interface ProgressStoryGateProps {
  /** Days with ≥1 logged meal in the CURRENT WEEK (the card's window). */
  daysLogged: number;
  /**
   * Whether the account has any logged history at all (journal store,
   * not range-scoped). Switches the copy from cold-start ("your first
   * insight") to new-week framing — a returning user must never be told
   * to "log a meal to start the count" next to an adherence card full
   * of their own data (fresh-eyes 2026-06-10 P0-2, Grace report).
   */
  hasHistory?: boolean;
  style?: ViewStyle;
  testID?: string;
}

function ProgressStoryGateImpl({
  daysLogged,
  hasHistory,
  style,
  testID,
}: ProgressStoryGateProps) {
  const accent = useAccent();
  const colors = useThemeColors();
  // Mirrors ProgressHeadline (geometry-twin contract) — soft page-ground lift.
  const cardElevation = useCardElevation({ variant: "soft" });
  const placeholder = buildProgressStoryPlaceholder(daysLogged, { hasHistory });

  // Day-count indicator — STORY_DATA_FLOOR_DAYS discrete ring segments
  // (filled clay per logged day, hairline track otherwise). The gate
  // counts whole days, so the indicator is discrete: the previous
  // continuous arc with a 6% minimum fill (ENG-1006) read as a STUCK
  // LOADING SPINNER at 0/3 (fresh-eyes 2026-06-10, Grace report) —
  // superseded by segments, which are structurally visible at zero.
  const RING_SIZE = 24;
  const STROKE = 3;
  const radius = (RING_SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const SEGMENT_GAP = 4; // px of arc between segments
  const segmentCount = STORY_DATA_FLOOR_DAYS;
  const segmentLen = Math.max(2, circumference / segmentCount - SEGMENT_GAP);
  const gapDeg = (SEGMENT_GAP / circumference) * 360;

  return (
    <View
      testID={testID ?? "progress-story-gate"}
      accessibilityRole="text"
      accessibilityLabel={`This week: ${placeholder.headline}. ${placeholder.body} ${placeholder.ringLabel} days logged.`}
      style={[
        styles.card,
        cardElevation.shadowStyle,
        {
          // ENG-1081 — white slab (cohesion). Was flag-gated (lilac wash in the
          // else); collapsed in ENG-1356. Twin of ProgressHeadline.
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderColor: colors.cardBorder,
          borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
        },
        style,
      ]}
    >
      <Text
        style={[
          Type.label,
          {
            // headers census 2026-06-10: eyebrow → AA-safe accent.primarySolid.
            color: accent.primarySolid,
            marginBottom: Spacing.sm,
          },
        ]}
      >
        {placeholder.eyebrow}
      </Text>

      <View style={styles.headerRow}>
        <Text
          style={[
            Type.headline,
            { color: colors.text, flex: 1 },
          ]}
          accessibilityRole="header"
        >
          {placeholder.headline}
        </Text>
        <View
          style={{ width: RING_SIZE, height: RING_SIZE, marginLeft: Spacing.md, alignItems: "center", justifyContent: "center" }}
          testID="progress-story-gate-ring"
        >
          <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: "absolute" }}>
            {Array.from({ length: segmentCount }, (_, i) => (
              <Circle
                key={i}
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={radius}
                stroke={i < placeholder.segmentsFilled ? accent.primary : colors.cardBorder}
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${segmentLen} ${circumference - segmentLen}`}
                transform={`rotate(${-90 + (i * 360) / segmentCount + gapDeg / 2} ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            ))}
          </Svg>
          {/* fit-and-finish (Grace 2026-07-11): the in-ring numeral is gone —
              "1/3" cramped inside the small ring and duplicated the caption
              below (supersedes the ENG-1372 slice-2 numeral-with-ring note).
              The segmented ring alone is the progress signal. */}
        </View>
      </View>

      <Text
        style={[
          styles.body,
          { color: colors.textSecondary },
        ]}
      >
        {placeholder.body}
      </Text>


    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // ENG-1006 — match the cream sibling cards' radius (CARD_RADIUS = 24)
    // so the lilac THIS WEEK card doesn't sit at a detectably different
    // corner radius from the AVERAGE ADHERENCE / weight / daily-calories
    // cards stacked below it.
    borderRadius: CARD_RADIUS,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  body: {
    // ENG-1006 — 13pt label-secondary floor (was 12pt, below the spec's
    // 13–14pt body floor and small under the serif headline).
    fontSize: 13,
    lineHeight: 18,
    marginTop: Spacing.sm,
  },
});

export const ProgressStoryGate = memo(ProgressStoryGateImpl);

export default ProgressStoryGate;
