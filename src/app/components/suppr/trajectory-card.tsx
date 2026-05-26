"use client";

/**
 * `<TrajectoryCard>` — ENG-741 (web).
 *
 * A separate, calm forecast card that sits directly under the weight
 * chart on Progress. Answers Grace's ask: "if you keep going at this
 * pace you'll be X." It does NOT touch the weight chart and is distinct
 * from the lower "Journey" card (goal-anchored days-to-goal + progress
 * bar). This card is pure trajectory.
 *
 * State machine is delegated entirely to the shared `computeTrajectory`
 * helper so web ↔ mobile cannot drift and no maths is duplicated:
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
 * Tone: blue/primary, not red/green — it's a forecast, not a verdict.
 * Tokens only; numbers use `tabular-nums`.
 *
 * Mirror: `apps/mobile/components/progress/TrajectoryCard.tsx`.
 */

import * as React from "react";
import {
  computeTrajectory,
  type TrajectoryState,
  type WeightGoalTimeline,
} from "../../../lib/weightProjection";

export interface TrajectoryCardProps {
  byDay: Record<string, Array<{ calories?: number | null }>>;
  latestWeightKg: number | null;
  targetCalories: number;
  maintenanceTdeeKcal?: number | null;
  goal?: string | null;
  timeline?: WeightGoalTimeline | null;
  className?: string;
}

export function TrajectoryCard(props: TrajectoryCardProps) {
  const { className, ...input } = props;
  const state: TrajectoryState | null = computeTrajectory(input);

  if (!state) return null;

  return (
    <section
      data-slot="trajectory-card"
      data-testid="trajectory-card"
      className={[
        "rounded-2xl border border-border bg-card p-4 mb-6 card-elevated",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={accessibilityLabelFor(state)}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="inline-block w-[7px] h-[7px] rounded-full"
          style={{
            background:
              state.kind === "projection"
                ? "var(--primary)"
                : "var(--muted-foreground)",
          }}
        />
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          PROJECTED WEIGHT
        </p>
      </div>

      {state.kind === "projection" ? (
        <>
          <p className="flex items-baseline gap-2 mb-1">
            <span
              data-testid="trajectory-hero-kg"
              className="text-[30px] font-extrabold tracking-[-0.5px] text-primary tabular-nums ph-mask"
            >
              {state.projectedKg} kg
            </span>
            <span
              data-testid="trajectory-hero-when"
              className="text-sm font-semibold text-muted-foreground"
            >
              in ~{state.weeks} weeks
            </span>
          </p>
          <p
            data-testid="trajectory-basis"
            className="text-xs leading-relaxed text-muted-foreground"
          >
            If you keep your current pace — last 7 days averaged{" "}
            <span className="font-bold text-foreground">
              {state.avgCalories.toLocaleString()} kcal/day
            </span>{" "}
            vs{" "}
            <span className="font-bold text-foreground">
              {state.targetCalories.toLocaleString()}
            </span>{" "}
            target.
          </p>
          <p
            data-testid="trajectory-footnote"
            className="text-[10.5px] text-muted-foreground/80 mt-2"
          >
            Based on 7,700 kcal &asymp; 1 kg. An estimate, not a promise.
          </p>
        </>
      ) : (
        <>
          <p
            data-testid="trajectory-placeholder-title"
            className="text-[15px] font-bold text-foreground mb-1"
          >
            {state.daysRemaining > 0
              ? `Log ${state.daysRemaining} more day${state.daysRemaining === 1 ? "" : "s"} to see your trajectory`
              : "Keep logging to see your trajectory"}
          </p>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            We project from your last 7 days. A 3-day average swings too much to
            forecast honestly.
          </p>
          <div
            data-testid="trajectory-progress-track"
            className="h-1.5 rounded-full bg-muted overflow-hidden mt-3"
          >
            <div
              data-testid="trajectory-progress-fill"
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct(state)}%`,
                background: "var(--primary)",
              }}
            />
          </div>
        </>
      )}
    </section>
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

export default TrajectoryCard;
