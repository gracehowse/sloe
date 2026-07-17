import { StyleSheet, Text, View, useColorScheme } from "react-native";
import { Plus, TrendingDown, TrendingUp } from "lucide-react-native";

import { CARD_RADIUS, SupprCard } from "@/components/ui/SupprCard";
import { SupprButton } from "@/components/ui/SupprButton";
import { HierarchyOverline } from "@/components/progress/hierarchy/HierarchyOverline";
import { WeightChart } from "@/components/progress/WeightChart";
import { WeightSparseState } from "@/components/progress/WeightSparseState";
import { Accent, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  computeTrajectory,
  hasGoalWeightData,
  signedObservedKgPerWeek,
  trendDirectionTone,
  type TrajectoryState,
  type WeightGoalTimeline,
} from "@/lib/weightProjection";
import type { WeightRange, WeightTrendResult } from "@/lib/progress/weightTrend";
import { isFeatureEnabled } from "@/lib/analytics";
import { ENERGY_NUMBERS_V1_FLAG } from "@suppr/nutrition-core/energyNumbers";
import type { WeightSurfaceMode } from "@suppr/nutrition-core/weightSurfaceMode";
import {
  formatWeightForUnit,
  type MeasurementSystem,
} from "@suppr/shared/measurements";
import {
  TREND_ONLY_MODE_NOTE,
  describeTrendOnly,
  trendOnlyDirection,
} from "@suppr/shared/preferences/trendOnlyWeight";

/**
 * ENG-1525 §1 — the Trajectory hero: the ONLY tinted card on the Progress
 * page (deliberate ENG-1497 carve-out — one tinted hero on a flat field;
 * recorded in docs/decisions/2026-07-16-progress-hierarchy-v1.md).
 *
 * Goal-conditional (delta 1):
 *  - `show`        → the tinted hero (serif kg numeral, smoothed rate,
 *                    canonical WeightChart, projection line, ghost Log weight).
 *  - `trends_only` → a PLAIN flat card carrying ONLY the shared body-neutral
 *                    trend phrase (legal-signed 2026-07-01 — no absolute
 *                    kg/lb anywhere, no directional glyph, and NO tint: the
 *                    tint belongs to the full weight hero only).
 *  - `hide`        → renders nothing; the composer promotes §2 This Week.
 *
 * All projection maths delegate to the shared `computeTrajectory` /
 * `projectWeight` machinery (via `@/lib/weightProjection`) — nothing is
 * re-derived here. The rate is the SMOOTHED `signedObservedKgPerWeek`
 * (never the raw two-point weekDeltaKg). Direction-aware colour (delta 3)
 * comes from the shared `trendDirectionTone`: sage toward goal, amber away
 * (never red), plum when no goal.
 */

/** The projected DATE only earns a render once ≥14 distinct weigh-in days
 *  exist (spec §1) — the distance line needs only the shared ≥5-day
 *  food-logging floor that `computeTrajectory` already enforces. */
export const MIN_WEIGH_IN_DAYS_FOR_DATE = 14;

export interface ProgressTrajectoryHeroProps {
  /** `effectiveWeightSurfaceMode` from the host (T13 + ENG-713 resolved). */
  mode: WeightSurfaceMode;
  latestWeightKg: number | null;
  goalWeightKg: number | null;
  weightKgByDay: Record<string, number>;
  measurementSystem: MeasurementSystem;
  /** Canonical trend for the chart window (host `weightChartTrend`). */
  trend: WeightTrendResult;
  range: WeightRange;
  /** Remount key for period paging — host passes `${period.type}:${period.offset}`. */
  chartKey: string;
  onSwipePrev?: () => void;
  onSwipeNext?: () => void;
  canSwipeNext?: boolean;
  byDay: Record<string, { calories?: number | null }[]>;
  targetCalories: number;
  maintenanceTdeeKcal: number | null;
  userGoal: string | null;
  /** `calcGoalTimeline` result when goal-weight data exists, else null. */
  timeline: WeightGoalTimeline | null;
  /** Range weight delta — drives the trends_only phrase only. */
  weekDeltaKg: number | null;
  periodWindowLabel: string;
  /** Opens the host's LogWeightSheet. */
  onLogWeight: () => void;
}

export function ProgressTrajectoryHero(props: ProgressTrajectoryHeroProps) {
  const colors = useThemeColors();
  const isDark = useColorScheme() === "dark";

  if (props.mode === "hide") return null;

  if (props.mode === "trends_only") {
    // Body-neutral phrase only — the T13 dignity contract (no kg, no glyph).
    const direction = trendOnlyDirection(props.weekDeltaKg);
    return (
      <SupprCard testID="progress-hierarchy-trend-only" lift="soft" padding="lg">
        <HierarchyOverline testID="progress-hierarchy-trajectory-overline">
          Weight
        </HierarchyOverline>
        <Text style={{ ...Type.bodyLarge, fontWeight: "600", color: colors.text }}>
          {describeTrendOnly(direction)}
        </Text>
        <Text style={{ ...Type.captionSmall, color: colors.textSecondary, marginTop: Spacing.xs }}>
          {TREND_ONLY_MODE_NOTE} · {props.periodWindowLabel}
        </Text>
      </SupprCard>
    );
  }

  const {
    latestWeightKg,
    goalWeightKg,
    weightKgByDay,
    measurementSystem,
    trend,
    timeline,
  } = props;
  const hasGoal = hasGoalWeightData({ goalWeightKg, latestWeightKg });
  const sparse = trend.points.length < 2;
  const fmtW = (kg: number) => formatWeightForUnit({ kg, system: measurementSystem });

  const rateKgPerWeek = timeline ? signedObservedKgPerWeek(timeline) : null;
  const tone = trendDirectionTone(rateKgPerWeek, latestWeightKg, goalWeightKg);
  const sage = isDark ? Accent.successLight : Accent.successSolid;
  const rateColor =
    tone === "toward" ? sage : tone === "away" ? colors.overBudgetFg : colors.navPrimary;

  return (
    <View
      testID="progress-hierarchy-trajectory-hero"
      style={{
        borderRadius: CARD_RADIUS,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.heroTintBorder,
        overflow: "hidden",
        padding: Spacing.lg,
      }}
    >
      {/* Hero wash — a flat token wash, not an SVG gradient: react-native-svg
          mangles rgba() alpha in gradient stops (renders the hue opaque), so
          the sim showed a solid plum slab. A plain View honours the token's
          alpha; the top→bottom fade stays a web-only nicety (deliberate
          platform deviation, same tokens). */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.heroTint }]}
      />

      <HierarchyOverline testID="progress-hierarchy-trajectory-overline">
        {hasGoal ? "Weight · toward goal" : "Weight"}
      </HierarchyOverline>

      {sparse ? (
        // ENG-1372 sparse grammar INSIDE the hero slot — its "Log your first
        // weigh-in" primary is the screen's ONE filled CTA in this state.
        <WeightSparseState
          points={trend.points}
          goalKg={goalWeightKg ?? null}
          onLogWeight={props.onLogWeight}
        />
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: Spacing.dense }}>
            {/* Largest numeral on the page — serif display at the 40 display
                band (legal per check:type-scale-mobile; same override shape
                as the legacy adherence hero). Session-replay masking is
                config-level on mobile (posthog-react-native masks text). */}
            <Text
              testID="progress-hierarchy-hero-kg"
              style={{ ...Type.display, fontSize: 40, lineHeight: 44, color: colors.text, fontVariant: ["tabular-nums"] }}
            >
              {latestWeightKg != null ? fmtW(latestWeightKg) : "—"}
            </Text>
            {rateKgPerWeek != null && rateKgPerWeek !== 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingBottom: Spacing.xs }}>
                {/* Anti-shame rule: the arrow stays factual/uncoloured; only
                    the number takes the direction tone. */}
                {rateKgPerWeek < 0 ? (
                  <TrendingDown size={14} color={colors.textSecondary} strokeWidth={1.75} />
                ) : (
                  <TrendingUp size={14} color={colors.textSecondary} strokeWidth={1.75} />
                )}
                <Text
                  testID="progress-hierarchy-hero-rate"
                  style={{ ...Type.captionStrong, color: rateColor, fontVariant: ["tabular-nums"] }}
                >
                  {fmtW(Math.abs(rateKgPerWeek))} / wk · trend
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ marginTop: Spacing.dense }}>
            <WeightChart
              key={props.chartKey}
              trend={trend}
              goalKg={goalWeightKg ?? null}
              isImperial={measurementSystem === "imperial"}
              range={props.range}
              onSwipePrev={props.onSwipePrev}
              onSwipeNext={props.onSwipeNext}
              canSwipeNext={props.canSwipeNext}
            />
          </View>

          <ProjectionLine
            byDay={props.byDay}
            latestWeightKg={latestWeightKg}
            targetCalories={props.targetCalories}
            maintenanceTdeeKcal={props.maintenanceTdeeKcal}
            userGoal={props.userGoal}
            goalWeightKg={goalWeightKg}
            timeline={timeline}
            weighInDayCount={Object.keys(weightKgByDay).length}
            measurementSystem={measurementSystem}
          />

          {/* Ghost pill — every CTA on the new branch is ghost except the
              sparse-state primary above. */}
          <SupprButton
            variant="ghost"
            testID="progress-hierarchy-log-weight"
            accessibilityLabel="Log weight"
            onPress={props.onLogWeight}
            style={{ marginTop: Spacing.md, alignSelf: "center", paddingVertical: Spacing.dense, paddingHorizontal: Spacing.md }}
          >
            <Plus size={16} color={colors.navPrimary} />
            <Text style={{ ...Type.button, color: colors.navPrimary, marginLeft: Spacing.sm }}>Log weight</Text>
          </SupprButton>
        </>
      )}
    </View>
  );
}

/**
 * Projection line — distance leads bold, date hedged, honesty footnote.
 * Reuses `computeTrajectory`'s state machine: `placeholder` (under the
 * shared ≥5-day floor, or no projectable average) → the settling line;
 * `projection` → the distance/date copy. The standalone TrajectoryCard does
 * NOT render in the new branch; this absorbs it.
 */
function ProjectionLine({
  byDay,
  latestWeightKg,
  targetCalories,
  maintenanceTdeeKcal,
  userGoal,
  goalWeightKg,
  timeline,
  weighInDayCount,
  measurementSystem,
}: {
  byDay: Record<string, { calories?: number | null }[]>;
  latestWeightKg: number | null;
  targetCalories: number;
  maintenanceTdeeKcal: number | null;
  userGoal: string | null;
  goalWeightKg: number | null;
  timeline: WeightGoalTimeline | null;
  weighInDayCount: number;
  measurementSystem: MeasurementSystem;
}) {
  const colors = useThemeColors();
  const state: TrajectoryState | null = computeTrajectory({
    byDay,
    latestWeightKg,
    targetCalories,
    maintenanceTdeeKcal,
    goal: userGoal,
    timeline,
    goalWeightKg,
    // Render-time copy flag (same inline read as TrajectoryCard) — not a
    // structural gate, so no read-once-on-mount dance needed.
    normalizeGoalVocabulary: isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG),
  });

  if (!state) return null;

  if (state.kind === "placeholder") {
    return (
      <Text
        testID="progress-hierarchy-projection-settling"
        style={{ ...Type.captionSmall, color: colors.textSecondary, marginTop: Spacing.dense }}
      >
        Trend still settling — keep logging.
      </Text>
    );
  }

  // A projection with no goal weight is legitimately goal-independent
  // (ENG-1373) but has no "to go" distance — the hero's rate row already
  // carries the pace, so add nothing rather than imply a goal.
  if (!timeline || timeline.remainingKg <= 0.1) return null;

  const dateLabel = (() => {
    if (weighInDayCount < MIN_WEIGH_IN_DAYS_FOR_DATE) return null;
    if (timeline.daysToGoal == null || timeline.daysToGoal <= 0) return null;
    const d = new Date();
    d.setDate(d.getDate() + timeline.daysToGoal);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  })();

  return (
    <View testID="progress-hierarchy-projection" style={{ marginTop: Spacing.dense }}>
      <Text style={{ ...Type.bodyLarge, color: colors.text }}>
        <Text style={{ fontWeight: "700", fontVariant: ["tabular-nums"] }}>
          {formatWeightForUnit({ kg: timeline.remainingKg, system: measurementSystem })} to go
        </Text>
        {dateLabel ? (
          <Text style={{ color: colors.textSecondary }}> · at this pace ~{dateLabel}</Text>
        ) : null}
      </Text>
      <Text style={{ ...Type.caption, color: colors.textTertiary, marginTop: Spacing.xs }}>
        An estimate, not a promise.
      </Text>
    </View>
  );
}

export default ProgressTrajectoryHero;
