"use client";

/**
 * ProgressTrajectoryHero — ENG-1525 §1 (web).
 *
 * The ONLY tinted card on the hierarchy-v1 Progress page: one weight hero
 * that absorbs the legacy weight card + TrajectoryCard + Journey projection.
 * Tint = `--hero-tint` trio (deliberate ENG-1497 carve-out — one tinted hero
 * on a flat field; recorded in the 2026-07-16 decision doc).
 *
 * Goal-conditional (delta 1):
 *   - `surfaceMode === "show"`      → tinted hero (numeral + chart + projection).
 *   - `surfaceMode === "trends_only"` → PLAIN flat card, trend-direction copy
 *     ONLY (shared `describeTrendOnly` strings, legal-signed 2026-07-01 —
 *     no absolute kg anywhere).
 *   - Full opt-out ("hide") → the composer renders NO Trajectory section.
 *
 * Direction-aware colour (delta 3) comes from the shared
 * `trendDirectionTone` — sage toward goal, amber away, plum neutral. Never red.
 *
 * All maths is delegated to shared helpers (`computeTrajectory`,
 * `signedObservedKgPerWeek`) — the smoothed weekly rate, never the raw
 * two-point delta. ph-mask on every absolute-weight numeral (ENG-534).
 *
 * Mirror: `apps/mobile/components/progress/hierarchy/ProgressTrajectoryHero`.
 */

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import {
  computeTrajectory,
  hasGoalWeightData,
  signedObservedKgPerWeek,
  trendDirectionTone,
  type TrendDirectionTone,
  type WeightGoalTimeline,
} from "../../../../lib/weightProjection";
import { kgToLb } from "../../../../lib/nutrition/tdee";
import {
  describeTrendOnly,
  trendOnlyDirection,
  TREND_ONLY_MODE_NOTE,
} from "../../../../lib/preferences/trendOnlyWeight";
import { SupprCard } from "../../ui/suppr-card";
import { SupprButton } from "../suppr-button";
import { WeightChartTooltip } from "../../progress/WeightChartTooltip";
import { ProgressWeightEmptyState } from "../progress-weight-empty-state";
import { HierarchySectionOverline } from "./hierarchy-section-overline";

export type TrajectoryHeroChartPoint = {
  /** Bucket-aware axis label (host `weightChartData`). */
  date: string;
  /** Unit-converted weigh-in value (kg or lb per `isImperial`). */
  value: number;
  /** Unit-converted moving average — undefined entries are skipped. */
  ma?: number;
  isToday?: boolean;
};

export interface ProgressTrajectoryHeroProps {
  /** "hide" never reaches this component — the composer drops the section. */
  surfaceMode: "show" | "trends_only";
  isImperial: boolean;
  latestWeightKg: number | null;
  goalWeightKg: number | null;
  /** Shared observed-rate timeline (`calcGoalTimeline`) — smoothed rate source. */
  timeline: WeightGoalTimeline | null;
  /** Distinct weigh-in DAYS on file — gates the projection DATE at ≥14. */
  weighInDayCount: number;
  /** Host `weightChartData` (already unit-converted). */
  chartData: TrajectoryHeroChartPoint[];
  /** Unit-converted goal for the dashed ReferenceLine (null hides it). */
  goalWeightChart: number | null;
  /** Daily bucket → raw line; weekly/monthly → MA line (legacy trend-view rule). */
  showRawDots: boolean;
  /** Journal by day — feeds `computeTrajectory`'s ≥5-food-day floor. */
  byDay: Record<string, Array<{ calories?: number | null }>>;
  targetCalories: number;
  maintenanceTdeeKcal?: number | null;
  goal?: string | null;
  /** Host-read `energy_numbers_v1` (ENG-1506). */
  normalizeGoalVocabulary?: boolean;
  /** trends_only branch only — direction input, never rendered as kg. */
  weekDeltaKg: number | null;
  /** Period window label for the trends_only descriptor (ENG-1030). */
  windowLabel: string;
  /** <2 weigh-ins → sparse grammar renders inside the hero slot (ENG-1504). */
  sparse: boolean;
  /** Reveal-then-focus on sparse; opens the inline log row otherwise. */
  onLogWeight: () => void;
  className?: string;
}

const TONE_CLASS: Record<TrendDirectionTone, string> = {
  toward: "text-success",
  away: "text-warning-solid",
  neutral: "text-foreground-brand",
};

const HERO_TINT_STYLE: React.CSSProperties = {
  background: "linear-gradient(180deg, var(--hero-tint), var(--hero-tint-to))",
  borderColor: "var(--hero-tint-border)",
};

function formatUnitWeight(kg: number, isImperial: boolean): string {
  return isImperial
    ? `${Math.round(kgToLb(kg) * 10) / 10} lb`
    : `${Math.round(kg * 10) / 10} kg`;
}

/** Chart child — same Recharts grammar as the legacy weight card, but the
 *  trend stroke is `var(--primary)` (new branch only; legacy untouched). */
function HeroWeightChart({
  data,
  goalValue,
  showRawDots,
  unit,
}: {
  data: TrajectoryHeroChartPoint[];
  goalValue: number | null;
  showRawDots: boolean;
  unit: "kg" | "lb";
}) {
  if (data.length < 2) return null;
  return (
    <div className="mt-3" data-testid="hierarchy-hero-chart">
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
          <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
            content={<WeightChartTooltip unit={unit} />}
          />
          {showRawDots ? (
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--primary)"
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 5, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }}
              connectNulls
            />
          ) : (
            <Line
              type="monotone"
              dataKey="ma"
              stroke="var(--primary)"
              strokeWidth={2.25}
              dot={false}
              connectNulls
            />
          )}
          {goalValue != null && (
            <ReferenceLine
              y={goalValue}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProgressTrajectoryHero(props: ProgressTrajectoryHeroProps) {
  const { surfaceMode, isImperial, className } = props;
  const unit: "kg" | "lb" = isImperial ? "lb" : "kg";

  if (surfaceMode === "trends_only") {
    // Plain flat card — the tint belongs to the absolute-weight hero only
    // (the hierarchy render test asserts the tint is absent here).
    const label = describeTrendOnly(trendOnlyDirection(props.weekDeltaKg));
    return (
      <SupprCard
        padding="lg"
        className={className}
        data-testid="progress-hierarchy-trend-only"
      >
        <HierarchySectionOverline label="Weight trend" />
        <p className="mt-2 text-[15px] font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {TREND_ONLY_MODE_NOTE} · {props.windowLabel}
        </p>
      </SupprCard>
    );
  }

  const {
    latestWeightKg,
    goalWeightKg,
    timeline,
    weighInDayCount,
    chartData,
    goalWeightChart,
    showRawDots,
    byDay,
    targetCalories,
    maintenanceTdeeKcal,
    goal,
    normalizeGoalVocabulary,
    sparse,
    onLogWeight,
  } = props;

  const rateKgPerWeek = timeline ? signedObservedKgPerWeek(timeline) : 0;
  const tone = trendDirectionTone(rateKgPerWeek, latestWeightKg, goalWeightKg);
  const hasGoal = hasGoalWeightData({ goalWeightKg, latestWeightKg });

  const trajectory = computeTrajectory({
    byDay,
    latestWeightKg,
    targetCalories,
    maintenanceTdeeKcal: maintenanceTdeeKcal ?? null,
    goal: goal ?? null,
    timeline,
    goalWeightKg,
    normalizeGoalVocabulary: normalizeGoalVocabulary ?? false,
  });

  const remainingKg =
    hasGoal && latestWeightKg != null && goalWeightKg != null
      ? Math.abs(goalWeightKg - latestWeightKg)
      : null;
  // Date is HEDGED and double-gated: the ≥5-food-day projection floor
  // (via `trajectory.kind === "projection"`) PLUS ≥14 weigh-in days.
  const paceDateLabel = (() => {
    if (weighInDayCount < 14) return null;
    if (timeline?.daysToGoal == null || timeline.daysToGoal <= 0) return null;
    const d = new Date();
    d.setDate(d.getDate() + timeline.daysToGoal);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  })();

  const rateAbs = Math.abs(rateKgPerWeek);
  const rateLabel =
    rateAbs >= 0.05
      ? `${rateKgPerWeek < 0 ? "↓" : "↑"} ${
          isImperial ? Math.round(kgToLb(rateAbs) * 10) / 10 : Math.round(rateAbs * 100) / 100
        } ${unit} / wk · trend`
      : null;

  return (
    <SupprCard
      padding="lg"
      className={className}
      style={HERO_TINT_STYLE}
      data-testid="progress-hierarchy-hero"
      data-hero-tint="true"
    >
      <HierarchySectionOverline label={hasGoalWeightData({ goalWeightKg, latestWeightKg }) ? "Weight · toward goal" : "Weight"} />
      {sparse ? (
        // Sparse grammar INSIDE the hero slot (ENG-1372/1504 reveal-then-focus).
        // Its filled "Log your first weigh-in" CTA is the screen's ONE filled
        // CTA in this state — the ghost log pill below stays hidden.
        <ProgressWeightEmptyState
          className="mt-3"
          points={chartData.map((d) => ({ kg: d.value }))}
          goalKg={goalWeightChart ?? null}
          onLogWeight={onLogWeight}
        />
      ) : (
        <>
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="ph-mask">
              <span
                data-testid="hierarchy-hero-kg"
                className="font-[family-name:var(--font-headline)] text-[40px] font-medium leading-none tabular-nums text-foreground"
              >
                {latestWeightKg != null
                  ? isImperial
                    ? Math.round(kgToLb(latestWeightKg) * 10) / 10
                    : Math.round(latestWeightKg * 10) / 10
                  : "—"}
              </span>
              <span className="ml-1.5 text-[15px] text-muted-foreground">{unit}</span>
            </p>
            {rateLabel ? (
              <p
                data-testid="hierarchy-hero-rate"
                className={`shrink-0 text-right text-[13px] font-semibold tabular-nums ${TONE_CLASS[tone]}`}
              >
                {rateLabel}
              </p>
            ) : null}
          </div>

          <HeroWeightChart
            data={chartData}
            goalValue={goalWeightChart}
            showRawDots={showRawDots}
            unit={unit}
          />

          {/* Projection — distance leads bold, date hedged, honest footnote. */}
          {hasGoal && trajectory?.kind === "projection" ? (
            remainingKg != null && remainingKg > 0.05 ? (
              <div className="mt-3">
                <p className="text-[15px] text-foreground">
                  <span
                    data-testid="hierarchy-hero-distance"
                    className={`font-bold tabular-nums ph-mask ${TONE_CLASS[tone]}`}
                  >
                    {formatUnitWeight(remainingKg, isImperial)} to go
                  </span>
                  {paceDateLabel ? (
                    <span
                      data-testid="hierarchy-hero-date"
                      className="ml-1.5 text-[13px] text-muted-foreground"
                    >
                      · at this pace ~{paceDateLabel}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  An estimate, not a promise.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-muted-foreground">
                You&rsquo;ve reached your goal weight.
              </p>
            )
          ) : trajectory?.kind === "projection" && !hasGoal ? (
            // Goal-independent pace disclosure (ENG-1373 grammar) — no verdict.
            <p className="mt-3 text-[13px] text-muted-foreground">
              Pace shown from your logs (no goal weight set).
            </p>
          ) : (
            <p
              data-testid="hierarchy-hero-settling"
              className="mt-3 text-[13px] text-muted-foreground"
            >
              Trend still settling — keep logging.
            </p>
          )}

          {/* Ghost log affordance — the ONE filled CTA lives in the sparse
              state only; everything else on the new branch is ghost. */}
          <SupprButton
            variant="ghost"
            className="mt-2 -ml-3"
            data-testid="hierarchy-hero-log-cta"
            onClick={onLogWeight}
          >
            ＋ Log weight
          </SupprButton>
        </>
      )}
    </SupprCard>
  );
}

export default ProgressTrajectoryHero;
