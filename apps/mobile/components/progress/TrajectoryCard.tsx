import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { FontFamily, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { SupprCard } from "@/components/ui/SupprCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  computeTrajectory,
  type TrajectoryState,
  type WeightGoalTimeline,
} from "@/lib/weightProjection";

/**
 * `<TrajectoryCard>` — ENG-741.
 *
 * A separate, calm forecast card that sits directly under the weight
 * chart on Progress. Answers Grace's ask: "if you keep going at this
 * pace you'll be X." It does NOT touch the weight chart and is distinct
 * from the lower "Journey" card (which is goal-anchored: days-to-goal +
 * progress bar). This card is pure trajectory.
 *
 * State machine (delegated entirely to the shared `computeTrajectory`
 * helper so web ↔ mobile cannot drift and no maths is duplicated):
 *   - projection  (≥5 food-logged days): eyebrow + hero "{kg} kg in ~N
 *                 weeks" + basis line + 7,700 kcal footnote.
 *   - placeholder (<5 days):             eyebrow + "Log N more days…" +
 *                 honest explanation + thin progress bar.
 *   - null:                             render nothing (no current
 *                 weight — never invent a forecast).
 *
 * Hiding when weight tracking is opted out (`weightSurfaceMode !== "show"`)
 * is the caller's job — this component assumes it's only mounted in
 * "show" mode, matching the Journey card's gate.
 *
 * Tone: blue/accent, not red/green — it's a forecast, not a verdict.
 * Tokens only; numbers use `tabular-nums`.
 *
 * Mirror: `src/app/components/suppr/trajectory-card.tsx`.
 */
export interface TrajectoryCardProps {
  byDay: Record<string, { calories?: number | null }[]>;
  latestWeightKg: number | null;
  targetCalories: number;
  maintenanceTdeeKcal?: number | null;
  goal?: string | null;
  timeline?: WeightGoalTimeline | null;
  style?: ViewStyle;
  testID?: string;
}

export function TrajectoryCard(props: TrajectoryCardProps) {
  const { style, testID, ...input } = props;
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the projection line,
  // its label, and the projection marker.
  const accent = useAccent();
  const state: TrajectoryState | null = computeTrajectory(input);

  if (!state) return null;

  return (
    // Card chrome (fill #F6F5F2, radius 20, soft lift, hairline) is the shared
    // <SupprCard> shell — no more hand-rolled per-card chrome (Grace 2026-06-04).
    // lift="soft" (2026-06-09 one-card-treatment): the trajectory card sits
    // directly on the Progress page ground, so it floats with the soft lift like
    // every sibling content card. Mirrors web `elevation="card"`.
    <SupprCard
      testID={testID ?? "trajectory-card"}
      accessibilityLabel={accessibilityLabelFor(state)}
      lift="soft"
      padding="none"
      style={[styles.card, style]}
      innerStyle={styles.cardInner}
    >
      {/* Eyebrow — dot tints blue (projection) / muted (placeholder). */}
      <View style={styles.eyebrowRow}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor:
                state.kind === "projection" ? accent.primary : colors.textTertiary,
            },
          ]}
        />
        <Text style={[Type.label, { color: colors.textTertiary }]}>
          PROJECTED WEIGHT
        </Text>
      </View>

      {state.kind === "projection" ? (
        <>
          <View style={styles.heroRow}>
            {/* SLOE Phase 0: the projected-weight hero numeral reads in
                Newsreader serif (big numerals are a serif moment); the `kg`
                unit stays sans. Family carries the weight, so the sans
                `fontWeight: 800` is dropped. Mirrors web trajectory-card. */}
            <Text
              testID="trajectory-hero-kg"
              style={{
                fontFamily: FontFamily.serifRegular,
                fontSize: 30,
                letterSpacing: -0.5,
                color: accent.primarySolid,
                fontVariant: ["tabular-nums"],
              }}
            >
              {state.projectedKg}
              <Text style={{ fontFamily: FontFamily.sansSemibold, fontSize: 16, fontWeight: "600" }}> kg</Text>
            </Text>
            <Text
              testID="trajectory-hero-when"
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.textSecondary,
                marginLeft: 8,
              }}
            >
              in ~{state.weeks} weeks
            </Text>
          </View>
          <Text
            testID="trajectory-basis"
            style={[styles.basis, { color: colors.textSecondary }]}
          >
            If you keep your current pace — last 7 days averaged{" "}
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {state.avgCalories.toLocaleString()} kcal/day
            </Text>{" "}
            vs{" "}
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {state.targetCalories.toLocaleString()}
            </Text>{" "}
            target.
          </Text>
          <Text
            testID="trajectory-footnote"
            style={[styles.footnote, { color: colors.textTertiary }]}
          >
            Based on 7,700 kcal {"≈"} 1 kg. An estimate, not a promise.
          </Text>
        </>
      ) : (
        <>
          <Text
            testID="trajectory-placeholder-title"
            style={[styles.phTitle, { color: colors.text }]}
          >
            {state.daysRemaining > 0
              ? `Log ${state.daysRemaining} more day${state.daysRemaining === 1 ? "" : "s"} to see your trajectory`
              : "Keep logging to see your trajectory"}
          </Text>
          <Text style={[styles.phSub, { color: colors.textSecondary }]}>
            We project from your last 7 days. A 3-day average swings too much to
            forecast honestly.
          </Text>
          <View
            testID="trajectory-progress-track"
            style={[styles.barTrack, { backgroundColor: colors.border }]}
          >
            <View
              testID="trajectory-progress-fill"
              style={[
                styles.barFill,
                {
                  backgroundColor: accent.primary,
                  width: `${progressPct(state)}%`,
                },
              ]}
            />
          </View>
        </>
      )}
    </SupprCard>
  );
}

function progressPct(
  state: Extract<TrajectoryState, { kind: "placeholder" }>,
): number {
  if (state.daysRequired <= 0) return 100;
  const pct = Math.round((state.daysLogged / state.daysRequired) * 100);
  return Math.max(0, Math.min(100, pct));
}

function accessibilityLabelFor(state: TrajectoryState): string {
  if (state.kind === "projection") {
    return `Projected weight ${state.projectedKg} kilograms in about ${state.weeks} weeks if you keep your current pace. An estimate, not a promise.`;
  }
  return state.daysRemaining > 0
    ? `Projected weight. Log ${state.daysRemaining} more days to see your trajectory.`
    : "Projected weight. Keep logging to see your trajectory.";
}

const styles = StyleSheet.create({
  // Chrome (radius/border/fill/lift) is the <SupprCard> shell; this only
  // carries the card's outer margin.
  card: {
    marginBottom: Spacing.md,
  },
  // The card's asymmetric content padding (the shell uses symmetric `padding`).
  cardInner: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: 16,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  heroRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 4 },
  basis: { fontSize: 12, lineHeight: 18 },
  footnote: { fontSize: 10.5, marginTop: 8 },
  phTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  phSub: { fontSize: 12.5, lineHeight: 18 },
  barTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: Spacing.dense,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3 },
});

export default TrajectoryCard;
