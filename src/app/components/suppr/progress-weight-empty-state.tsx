"use client";

import * as React from "react";
import { Scale } from "lucide-react";

/**
 * ProgressWeightEmptyState — ENG-1372 slice 2 upgrade of the ENG-1225 #22
 * "No weigh-ins yet" state. ALWAYS renders a chart frame (law 1: no hero at
 * zero visual weight) instead of the bare icon+text block:
 *   - 0 points → axis + optional dashed goal band + a filled "Log your first
 *     weigh-in" CTA sitting INSIDE the plot area (law 2).
 *   - 1 point  → the point + a dotted projection line toward the goal +
 *     "One more weigh-in unlocks your trend." (no trend claim yet).
 *
 * Folded onto the SAME `empty_state_grammar_v1` flag slice 1 shipped — no new
 * flag. Supersedes the narrower `web_progress_weight_empty` gate (0-point
 * only); the host (`ProgressDashboard.tsx`) now mounts this whenever
 * `weightChartData.length < 2`, closing the gap where a 1-weigh-in user saw a
 * hero numeral with an empty chart slot below it (the recharts `LineChart`
 * only renders at >=2 points).
 *
 * Mirror: `apps/mobile/components/progress/WeightSparseState.tsx`.
 */

const FRAME_WIDTH = 100; // viewBox units — scales via the SVG's own width:100%
const FRAME_HEIGHT = 46;
const PAD_X = 8;
const PAD_TOP = 6;
const PAD_BOTTOM = 10;

export interface ProgressWeightEmptyStateProps {
  /** Real weigh-in points (0 or 1 — the host gates this component out at >=2). */
  points: { kg: number }[];
  goalKg?: number | null;
  onLogWeight: () => void;
  className?: string;
}

export function ProgressWeightEmptyState({
  points,
  goalKg,
  onLogWeight,
  className,
}: ProgressWeightEmptyStateProps) {
  const plotLeft = PAD_X;
  const plotRight = FRAME_WIDTH - PAD_X;
  const plotTop = PAD_TOP;
  const plotBottom = FRAME_HEIGHT - PAD_BOTTOM;

  if (points.length === 0) {
    const goalY = goalKg != null ? plotTop + (plotBottom - plotTop) * 0.25 : null;
    return (
      <div
        data-testid="progress-weight-empty"
        className={`relative flex flex-col items-center overflow-hidden rounded-2xl bg-surface-warm pb-4 pt-3 ${className ?? ""}`}
      >
        <svg
          width="100%"
          height={FRAME_HEIGHT}
          viewBox={`0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} stroke="var(--border)" strokeWidth={0.5} />
          {goalY != null ? (
            <line
              x1={plotLeft}
              y1={goalY}
              x2={plotRight}
              y2={goalY}
              stroke="var(--muted-foreground)"
              strokeWidth={0.5}
              strokeDasharray="2 1.5"
            />
          ) : null}
        </svg>
        {goalKg != null ? (
          <p className="absolute right-2 text-[10px] text-muted-foreground" style={{ top: (goalY ?? 0) - 8 }}>
            Goal {goalKg.toFixed(1)} kg
          </p>
        ) : null}
        <div className="absolute inset-x-0 top-0 flex flex-col items-center justify-center gap-2" style={{ bottom: PAD_BOTTOM }}>
          <Scale size={22} strokeWidth={1.5} className="text-muted-foreground" aria-hidden />
          <button
            type="button"
            data-testid="progress-weight-empty-log-cta"
            onClick={onLogWeight}
            className="rounded-full bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Log your first weigh-in
          </button>
        </div>
      </div>
    );
  }

  // 1 weigh-in — the point + a dotted projection line toward the goal.
  const kg = points[0]!.kg;
  const pointX = plotLeft + (plotRight - plotLeft) * 0.22;
  const pointY = plotTop + (plotBottom - plotTop) * 0.55;
  const hasGoal = goalKg != null;
  const goalY = hasGoal
    ? pointY + (goalKg! < kg ? (plotBottom - plotTop) * 0.28 : -(plotBottom - plotTop) * 0.28)
    : pointY;
  const clampedGoalY = Math.max(plotTop, Math.min(plotBottom, goalY));

  return (
    <div
      data-testid="progress-weight-empty"
      className={`relative flex flex-col items-center overflow-hidden rounded-2xl bg-surface-warm pb-4 pt-3 ${className ?? ""}`}
    >
      <svg
        width="100%"
        height={FRAME_HEIGHT}
        viewBox={`0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} stroke="var(--border)" strokeWidth={0.5} />
        {hasGoal ? (
          <line
            x1={pointX}
            y1={pointY}
            x2={plotRight}
            y2={clampedGoalY}
            stroke="var(--macro-protein)"
            strokeWidth={0.75}
            strokeDasharray="1.5 2"
            strokeOpacity={0.6}
          />
        ) : null}
        <circle cx={pointX} cy={pointY} r={2.2} fill="var(--card)" stroke="var(--macro-protein)" strokeWidth={1} />
      </svg>
      <p
        className="absolute font-[family-name:var(--font-headline)] text-[15px] font-medium tabular-nums text-foreground"
        style={{ left: `calc(${(pointX / FRAME_WIDTH) * 100}% - 24px)`, top: 2, width: 48, textAlign: "center" }}
      >
        {kg.toFixed(1)} <span className="text-[11px] font-sans font-semibold">kg</span>
      </p>
      <div className="mt-1 flex flex-col items-center gap-2 px-4 text-center">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          One more weigh-in unlocks your trend.
        </p>
        <button
          type="button"
          data-testid="progress-weight-empty-log-cta"
          onClick={onLogWeight}
          className="rounded-full bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Log weight
        </button>
      </div>
    </div>
  );
}

export default ProgressWeightEmptyState;
