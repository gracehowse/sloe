"use client";

import * as React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import {
  GOAL_DEFAULT_PACE,
  PACE_PRESETS,
  PACE_RANGES,
  type Goal,
} from "@/lib/onboarding/v2/state";
import { useOnboardingV2 } from "../context";
import { MethodologyNote, StepBody, StepHeader } from "../scaffold";

/**
 * Pace step — step 09. The hairiest of the v2 steps because it ties
 * three policy decisions together:
 *
 *  1. Continuous slider with goal-aware min/max/step + 3 presets
 *     (config in `state.ts`).
 *  2. SOFT-WARN safety floor — banner shows but Continue stays
 *     enabled. The decision doc is the single source of truth here;
 *     the `legal-reviewer` sign-off owns the danger-banner copy.
 *  3. Live projected daily target so the user can see the trade-off.
 *
 *  Maintain auto-skips this step (handled in `state.resolveNextStep`).
 */

const ACCENT_BY_GOAL: Record<Exclude<Goal, "maintain">, string> = {
  lose: "var(--macro-fat)",
  gain: "var(--macro-protein)",
  recomp: "var(--macro-carbs)",
};

export function PaceStep() {
  const { state, set, targets, warning } = useOnboardingV2();
  const goal = (state.goal ?? "lose") as Exclude<Goal, "maintain">;
  const range = PACE_RANGES[goal];
  const presets = PACE_PRESETS[goal];
  const accent = ACCENT_BY_GOAL[goal];
  const pace = state.paceKgPerWeek ?? GOAL_DEFAULT_PACE[goal];

  const projectedTarget = targets?.target ?? null;
  const sign =
    goal === "lose" || goal === "recomp"
      ? "−"
      : goal === "gain"
        ? "+"
        : "";
  const dailyMagnitude =
    targets != null ? Math.abs(targets.kcalAdj) : null;

  // Stage E — fire the soft-warn analytics event when a warning
  // banner first appears for this reason during the step's lifetime.
  // The flow shell fires the matching `advanced` variant when the
  // user clicks Continue with a warning showing. Deduplicated via a
  // ref so rapid slider drags past threshold don't spam PostHog.
  const lastShownReasonRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!warning || projectedTarget == null) {
      lastShownReasonRef.current = null;
      return;
    }
    if (lastShownReasonRef.current === warning.reason) return;
    lastShownReasonRef.current = warning.reason;
    track(AnalyticsEvents.onboarding_pace_below_safety_floor, {
      acted: "shown",
      level: warning.level,
      reason: warning.reason,
      pace_kg_per_week: pace,
      projected_target_kcal: projectedTarget,
      sex: state.sex,
    });
  }, [warning, projectedTarget, pace, state.sex]);

  return (
    <StepBody>
      <StepHeader
        overline="Step 09 of 12"
        title={
          goal === "gain"
            ? "How fast should we gain?"
            : goal === "recomp"
              ? "How fast should we recomp?"
              : "How fast should we lose?"
        }
        subtitle="Slower is easier to sustain; faster asks more of you. You can change this anytime."
        compact
      />

      {/* Presets */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {presets.map((p) => {
          const active = Math.abs(pace - p.value) < range.step * 0.6;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => set({ paceKgPerWeek: p.value })}
              className={`flex flex-col items-start gap-0.5 px-2 py-2.5 rounded-md border-[1.5px] cursor-pointer transition-pm`}
              style={{
                backgroundColor: active
                  ? `color-mix(in oklab, ${accent} 14%, transparent)`
                  : "var(--input-background)",
                borderColor: active ? accent : "var(--border)",
                color: "var(--foreground)",
              }}
            >
              <span className="text-[13px] font-bold tracking-tight">
                {p.label}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {p.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      {/* Continuous slider */}
      <div className="bg-card border border-border rounded-card p-4">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Rate
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 mb-2.5">
          <span
            className="text-[34px] font-extrabold tracking-tight tabular-nums leading-none text-foreground"
            style={{ letterSpacing: "-0.02em" }}
          >
            {pace.toFixed(pace < 0.1 ? 3 : 2)}
          </span>
          <span className="text-sm font-semibold text-muted-foreground">
            kg / week
          </span>
        </div>
        <input
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={pace}
          onChange={(e) =>
            set({ paceKgPerWeek: parseFloat(e.target.value) })
          }
          aria-label="Weekly rate"
          aria-valuetext={`${pace.toFixed(2)} kg per week`}
          className="w-full h-1.5 cursor-pointer"
          style={{ accentColor: accent }}
        />
        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground tabular-nums">
          <span>{range.min} kg / wk</span>
          <span>{range.max} kg / wk</span>
        </div>
      </div>

      {/* Live projected target */}
      {projectedTarget != null && dailyMagnitude != null && (
        <div
          className="mt-3.5 grid grid-cols-2 gap-3 rounded-xl px-4 py-3.5 border"
          style={{
            backgroundColor: `color-mix(in oklab, ${accent} 14%, transparent)`,
            borderColor: `color-mix(in oklab, ${accent} 40%, transparent)`,
          }}
        >
          <div>
            <div className="section-label mb-1">Daily target</div>
            <div
              className="text-[22px] font-extrabold tracking-tight tabular-nums leading-none text-foreground"
              style={{ letterSpacing: "-0.02em" }}
            >
              {projectedTarget.toLocaleString()}
              <span className="text-xs text-muted-foreground font-medium ml-1">
                kcal
              </span>
            </div>
          </div>
          <div>
            <div className="section-label mb-1">vs. your TDEE</div>
            <div
              className="text-[22px] font-extrabold tracking-tight tabular-nums leading-none"
              style={{ letterSpacing: "-0.02em", color: accent }}
            >
              {sign}
              {dailyMagnitude.toLocaleString()}
              <span className="text-xs text-muted-foreground font-medium ml-1">
                kcal / day
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Soft-warn safety floor banner. Continue stays enabled — see
          decision doc + state.canAdvance. Analytics fire from the
          route component (Stage E). */}
      {warning && <PaceWarningBanner warning={warning} />}

      <MethodologyNote>
        Estimate uses ~7,700 kcal ≈ 1 kg of body mass. Safety floors
        reference NIH/NHS guidance. Suppr is not a substitute for medical
        advice — consult your doctor before any significant dietary
        change, especially if you&apos;re pregnant, under 18, or managing a
        medical condition.
      </MethodologyNote>
    </StepBody>
  );
}

function PaceWarningBanner({
  warning,
}: {
  warning: NonNullable<ReturnType<typeof useOnboardingV2>["warning"]>;
}) {
  const config = {
    danger: {
      bg: "rgba(217,69,69,0.12)",
      border: "rgba(217,69,69,0.45)",
      accent: "var(--destructive)",
      Icon: AlertTriangle,
    },
    warn: {
      bg: "rgba(232,148,45,0.12)",
      border: "rgba(232,148,45,0.45)",
      accent: "var(--warning)",
      Icon: AlertTriangle,
    },
    info: {
      bg: "color-mix(in oklab, var(--primary) 10%, transparent)",
      border: "color-mix(in oklab, var(--primary) 35%, transparent)",
      accent: "var(--primary)",
      Icon: Info,
    },
  }[warning.level];

  const { Icon } = config;

  return (
    <div
      className="mt-3 px-3.5 py-3 rounded-xl border flex gap-3 items-start"
      style={{
        backgroundColor: config.bg,
        borderColor: config.border,
      }}
      role="alert"
      data-warning-level={warning.level}
      data-warning-reason={warning.reason}
    >
      <div
        className="size-7 rounded-md grid place-items-center shrink-0 mt-px"
        style={{
          backgroundColor: `color-mix(in oklab, ${config.accent} 26%, transparent)`,
        }}
      >
        <Icon
          className="size-3.5"
          style={{ color: config.accent }}
          strokeWidth={2.5}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold tracking-tight text-foreground mb-1">
          {warning.title}
        </div>
        <div className="text-xs text-muted-foreground leading-relaxed">
          {warning.body}
        </div>
      </div>
    </div>
  );
}
