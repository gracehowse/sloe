"use client";

/**
 * `<PaywallTrajectoryChart>` — ENG-969 (web).
 *
 * A calm, single-line projected-weight chart for the Pro paywall (`/pricing`).
 * Answers the same question the Progress `<TrajectoryCard>` answers ("if you
 * keep this pace you'll be X"), rendered as a line you can SEE rather than a
 * single numeral — a quiet reason the goal is reachable, placed before the
 * sell.
 *
 * Honest framing (mirrors `src/app/components/suppr/trajectory-card.tsx`):
 *   - The PROJECTION maths is the shared `computeTrajectory()` helper — no
 *     re-derived numbers, no web ↔ mobile drift, and the 5-week linear cap
 *     (`MAX_LINEAR_PROJECTION_WEEKS`) is enforced by that helper.
 *   - The line is the primary accent (a forecast tone, never red/green verdict
 *     colours). The projected segment is dashed + the marker is a hollow ring
 *     so it reads "estimate", not "fact".
 *   - Copy is "An estimate, not a promise." — never a guarantee.
 *
 * On a CONVERSION surface we only render when there is a REAL projection to
 * show (`state.kind === "projection"`): ≥5 food-logged days AND a current
 * weight. Otherwise the chart renders NOTHING — we never fabricate a forecast
 * to sell against.
 *
 * The public `/pricing` route is UNAUTHENTICATED, so it has no per-user food
 * log / weight to project from. The host therefore mounts this with no data,
 * and the component renders nothing — net-neutral on the public route. The
 * component contract still matches mobile, so an authenticated web paywall
 * surface (or a future props-fed mount) renders the identical chart. The
 * platform difference is data availability, not behaviour.
 *
 * Flag: `paywall_trajectory_chart_v1` (default-ON since 2026-06-30, ENG-1279; component self-gates).
 *
 * Mirror: `apps/mobile/components/paywall/PaywallTrajectoryChart.tsx`.
 */

import * as React from "react";
import {
  computeTrajectory,
  TRAJECTORY_BEHAVIOUR_CAPTION,
  type TrajectoryState,
  type WeightGoalTimeline,
} from "../../src/lib/weightProjection.ts";
import { isFeatureEnabled } from "../../src/lib/analytics/track.ts";
import { ENERGY_NUMBERS_V1_FLAG } from "../../src/lib/nutrition/energyNumbers.ts";
import { SupprCard } from "../../src/app/components/ui/suppr-card.tsx";

/** Default-OFF flag (ENG-969). Registered in `KNOWN_DEFAULT_OFF_FLAGS` on both
 *  platforms; mirrored on mobile as the host-side gate in `apps/mobile/app/paywall.tsx`. */
export const PAYWALL_TRAJECTORY_CHART_FLAG = "paywall_trajectory_chart_v1";

const CHART_W = 280;
const CHART_H = 96;
const PAD_TOP = 14;
const PAD_BOTTOM = 14;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;

export interface PaywallTrajectoryChartProps {
  byDay?: Record<string, Array<{ calories?: number | null }>>;
  latestWeightKg?: number | null;
  targetCalories?: number | null;
  maintenanceTdeeKcal?: number | null;
  goal?: string | null;
  timeline?: WeightGoalTimeline | null;
  className?: string;
}

export function PaywallTrajectoryChart(props: PaywallTrajectoryChartProps) {
  const { className, byDay, latestWeightKg, targetCalories } = props;

  // Default-OFF flag gate (mirrors the host-side gate on the mobile paywall).
  // Self-gated here because `/pricing` is an RSC — flag reads must be client-side.
  if (!isFeatureEnabled(PAYWALL_TRAJECTORY_CHART_FLAG)) return null;

  // No per-user data (e.g. the public, unauthenticated /pricing route) → render
  // nothing. We never project from an empty input.
  if (
    byDay == null ||
    latestWeightKg == null ||
    typeof targetCalories !== "number"
  ) {
    return null;
  }

  const state: TrajectoryState | null = computeTrajectory({
    byDay,
    latestWeightKg,
    targetCalories,
    maintenanceTdeeKcal: props.maintenanceTdeeKcal,
    goal: props.goal,
    timeline: props.timeline,
    // ENG-1506 — host-read flag: OFF keeps the legacy 'lose'/'gain'-only
    // goal-fallback comparison (byte-identical flag-OFF geometry on this
    // conversion surface); ON understands the DB 'cut'/'bulk' vocabulary.
    normalizeGoalVocabulary: isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG),
  });

  // Conversion surface: only ever draw a REAL projection. No placeholder nag,
  // no fabricated forecast.
  if (!state || state.kind !== "projection") return null;

  const startKg = latestWeightKg;
  const endKg = state.projectedKg;

  const lo = Math.min(startKg, endKg);
  const hi = Math.max(startKg, endKg);
  const span = hi - lo;
  const padY = Math.max(span * 0.35, 0.4);
  const yMin = lo - padY;
  const yMax = hi + padY;

  const plotW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const toY = (kg: number) => {
    const d = yMax - yMin || 1;
    return PAD_TOP + plotH - ((kg - yMin) / d) * plotH;
  };
  const x0 = PAD_LEFT;
  const x1 = PAD_LEFT + plotW;
  const y0 = toY(startKg);
  const y1 = toY(endKg);
  const projectedLine = `M ${x0.toFixed(1)} ${y0.toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  const areaPath = `${projectedLine} L ${x1.toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} L ${x0.toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} Z`;

  return (
    <SupprCard
      data-slot="paywall-trajectory-chart"
      data-testid="paywall-trajectory-chart"
      elevation="card"
      padding="lg"
      radius="xl"
      className={["mb-5", className ?? ""].filter(Boolean).join(" ")}
      aria-label={`Projected weight ${endKg} kilograms in about ${state.weeks} weeks if you keep your current pace. An estimate, not a promise.`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="inline-block w-[7px] h-[7px] rounded-full"
          style={{ background: "var(--primary)" }}
        />
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          PROJECTED WEIGHT
        </p>
      </div>

      <p className="flex items-baseline gap-2 mb-2">
        {/* SLOE Phase 0: the projected-weight hero numeral reads in the
            Newsreader serif display face; the `kg` unit stays sans. Mirrors
            mobile PaywallTrajectoryChart. */}
        <span
          data-testid="paywall-trajectory-hero-kg"
          className="font-[family-name:var(--font-headline)] text-[26px] font-medium leading-none tracking-[-0.5px] text-primary tabular-nums ph-mask"
        >
          {endKg}
          <span className="font-sans text-[15px] font-semibold"> kg</span>
        </span>
        <span
          data-testid="paywall-trajectory-when"
          className="text-[13px] font-semibold text-muted-foreground"
        >
          in ~{state.weeks} weeks
        </span>
      </p>

      <svg
        data-testid="paywall-trajectory-svg"
        width={CHART_W}
        height={CHART_H}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="max-w-full"
        role="presentation"
      >
        <defs>
          <linearGradient id="paywallTrajGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.14" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Soft fill under the projection line. */}
        <path d={areaPath} fill="url(#paywallTrajGrad)" />

        {/* Projected segment — dashed so it reads "estimate", not "fact". */}
        <path
          d={projectedLine}
          stroke="var(--primary)"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeDasharray="6 5"
          fill="none"
        />

        {/* "Now" anchor — solid dot at current weight. */}
        <circle cx={x0} cy={y0} r={4.5} fill="var(--primary)" />

        {/* Projected end — hollow ring (filled with card colour) = an estimate. */}
        <circle
          cx={x1}
          cy={y1}
          r={5}
          fill="var(--card)"
          stroke="var(--primary)"
          strokeWidth={2}
        />
      </svg>

      <p
        data-testid="paywall-trajectory-basis"
        className="text-xs leading-relaxed text-muted-foreground mt-2"
      >
        If you keep your current pace — last 7 days averaged{" "}
        <span className="font-bold text-foreground">
          {state.avgCalories.toLocaleString()} kcal/day
        </span>
        .
      </p>
      {/* ENG-1507 — behaviour-vs-plan qualifier (mirror of mobile): the
          projection direction is recent intake vs estimated burn, NOT the
          plan. Flag-gated. */}
      {isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG) ? (
        <p
          data-testid="paywall-trajectory-behaviour-caption"
          className="text-xs leading-relaxed text-muted-foreground mt-2"
        >
          {TRAJECTORY_BEHAVIOUR_CAPTION}
        </p>
      ) : null}
      <p
        data-testid="paywall-trajectory-footnote"
        className="text-[10.5px] text-muted-foreground/80 mt-2"
      >
        Based on 7,700 kcal &asymp; 1 kg. An estimate, not a promise.
      </p>
    </SupprCard>
  );
}

export default PaywallTrajectoryChart;
