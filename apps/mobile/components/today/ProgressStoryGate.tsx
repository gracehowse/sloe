import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Accent, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  PROGRESS_INSIGHT_LILAC_BG,
  PROGRESS_INSIGHT_LILAC_BORDER,
} from "@/components/today/ProgressHeadline";
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

export function ProgressStoryGate({
  daysLogged,
  hasHistory,
  style,
  testID,
}: ProgressStoryGateProps) {
  const accent = useAccent();
  const colors = useThemeColors();
  const cardElevation = useCardElevation();
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
          // Sloe Figma 492:2 — same lilac insight wash as <ProgressHeadline>
          // so the slot doesn't change tone when the live story unlocks.
          backgroundColor: PROGRESS_INSIGHT_LILAC_BG,
          borderColor: PROGRESS_INSIGHT_LILAC_BORDER,
          borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
        },
        style,
      ]}
    >
      <Text
        style={[
          Type.label,
          {
            color: accent.primary,
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
          style={{ width: RING_SIZE, height: RING_SIZE, marginLeft: Spacing.md }}
          testID="progress-story-gate-ring"
        >
          <Svg width={RING_SIZE} height={RING_SIZE}>
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

      <Text
        testID="progress-story-gate-ring-label"
        style={{
          fontSize: 11,
          color: colors.textTertiary,
          marginTop: Spacing.sm,
          fontVariant: ["tabular-nums"],
        }}
      >
        {/*
          V17 (2026-05-11 visual sweep): "3-day floor" was jargon —
          the user had to infer it meant "minimum 3 days needed to
          unlock insights". Replaced with the plain-English version
          "needed to unlock" so the meaning is immediate.
        */}
        {placeholder.ringLabel} days logged · {STORY_DATA_FLOOR_DAYS} needed to unlock
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

export default ProgressStoryGate;
