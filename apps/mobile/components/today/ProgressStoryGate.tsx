import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Accent, Elevation, Radius, Spacing, Type } from "@/constants/theme";
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
  /** Days with ≥1 logged meal in the rolling window. */
  daysLogged: number;
  style?: ViewStyle;
  testID?: string;
}

export function ProgressStoryGate({
  daysLogged,
  style,
  testID,
}: ProgressStoryGateProps) {
  const colors = useThemeColors();
  const placeholder = buildProgressStoryPlaceholder(daysLogged);

  // Ring geometry — small (24pt), single-stroke arc that fills as
  // logged days approach the floor. Clamps at 1 so the ring snaps
  // closed once the user reaches the threshold (and the live story
  // takes over on the next render).
  const RING_SIZE = 24;
  const STROKE = 3;
  const radius = (RING_SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - placeholder.ringFraction);

  return (
    <View
      testID={testID ?? "progress-story-gate"}
      accessibilityRole="text"
      accessibilityLabel={`This week: ${placeholder.headline}. ${placeholder.body} ${placeholder.ringLabel} days logged.`}
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
      <Text
        style={[
          Type.label,
          {
            color: Accent.primary,
            marginBottom: 6,
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
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              stroke={colors.cardBorder}
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              stroke={Accent.primary}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
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
          marginTop: 8,
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
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  body: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
});

export default ProgressStoryGate;
