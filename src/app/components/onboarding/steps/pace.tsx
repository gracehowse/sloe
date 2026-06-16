"use client";

import * as React from "react";
import { AlertTriangle, Check, Info } from "lucide-react";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";
import {
  GOAL_DEFAULT_PACE,
  PACE_PRESETS,
  PACE_RANGES,
  type Goal,
} from "@/lib/onboarding/state";
import { useOnboarding } from "../context";
import { MethodologyNote, StepBody, StepHeader, useStepOverline } from "../scaffold";
import { BrandedSlider } from "../branded-slider";
import { useTweenedNumber } from "../use-tweened-number";

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
  const { state, set, targets, warning } = useOnboarding();
  const overline = useStepOverline();
  // No auto-reset of `paceDangerAcknowledged` here.
  //
  // Earlier this component reset the ack whenever the warning reason
  // changed, on the theory that crossing in/out of danger should
  // require a fresh tick (Grace 2026-04-20: that effect was clobbering
  // the tick mid-drag — user ticked the box, the slider tween nudged
  // the projected target a kcal across a band threshold, the ref
  // mismatch fired, the ack reset to false, and Continue stayed
  // disabled with no visible reason).
  //
  // Behaviour now: the tick is sticky. Once the user acknowledges, it
  // stays acknowledged until they untick or leave the step. That still
  // satisfies the legal-reviewer Stage F requirement (advance below
  // the floor requires a deliberate, explicit tick) without the UX
  // booby-trap.
  const goal = (state.goal ?? "lose") as Exclude<Goal, "maintain">;
  const range = PACE_RANGES[goal];
  const presets = PACE_PRESETS[goal];
  const accent = ACCENT_BY_GOAL[goal];
  const pace = state.paceKgPerWeek ?? GOAL_DEFAULT_PACE[goal];

  // Commit the visible default into state so Continue works on first
  // paint and persisted onboarding records the chosen pace.
  React.useEffect(() => {
    if (state.goal === "maintain" || state.goal === null) return;
    if (state.paceKgPerWeek === null) {
      set({ paceKgPerWeek: GOAL_DEFAULT_PACE[state.goal] });
    }
  }, [state.goal, state.paceKgPerWeek, set]);

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
        overline={overline}
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
          {/* Sloe reskin (Figma pace 191:2): the rate hero numeral reads
              in the Newsreader serif display face + plum heading ink,
              matching the warm-coaching numeral treatment. */}
          <span
            className="font-[family-name:var(--font-display)] text-[36px] font-normal tracking-tight tabular-nums leading-none text-foreground-brand"
            style={{ letterSpacing: "-0.01em" }}
          >
            {pace.toFixed(pace < 0.1 ? 3 : 2)}
          </span>
          <span className="text-sm font-semibold text-muted-foreground">
            kg / week
          </span>
        </div>
        <BrandedSlider
          value={pace}
          onChange={(v) => set({ paceKgPerWeek: v })}
          min={range.min}
          max={range.max}
          step={range.step}
          accent={accent}
          ariaLabel="Weekly rate"
          formatBubble={(v) => `${v.toFixed(2)} kg / wk`}
        />
        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground tabular-nums">
          <span>{range.min} kg / wk</span>
          <span>{range.max} kg / wk</span>
        </div>
      </div>

      {/* Live projected target — tweened so numbers don't snap on
          each slider tick (ui-critic premium-tier upgrade #3). */}
      {projectedTarget != null && dailyMagnitude != null && (
        <ProjectionTile
          accent={accent}
          target={projectedTarget}
          delta={dailyMagnitude}
          sign={sign}
        />
      )}

      {/* Soft-warn safety floor banner. For info / warn, Continue
          stays enabled. For `danger`, Continue stays soft-warn but
          requires the explicit acknowledgement checkbox below the
          banner per legal-reviewer Stage F sign-off. Analytics fire
          from the route component for `advanced`, from this step's
          useEffect for `shown`. */}
      {warning && (
        <PaceWarningBanner
          warning={warning}
          acknowledged={state.paceDangerAcknowledged}
          onAcknowledgeChange={(v) => set({ paceDangerAcknowledged: v })}
        />
      )}

      <MethodologyNote>
        Estimate uses ~7,700 kcal ≈ 1 kg of body mass. Safety floors
        reference NIH/NHS guidance. Sloe is not a substitute for medical
        advice — consult your doctor before any significant dietary
        change, especially if you&apos;re pregnant, under 18, or managing a
        medical condition.
      </MethodologyNote>
    </StepBody>
  );
}

function ProjectionTile({
  accent,
  target,
  delta,
  sign,
}: {
  accent: string;
  target: number;
  delta: number;
  sign: string;
}) {
  // Tween at ~220 ms per visual-qa P0 fix — eliminates the integer-by-
  // integer snap on slider drags. tabular-nums + Math.round below
  // keeps the rolling display from jittering.
  const tweenedTarget = useTweenedNumber(target);
  const tweenedDelta = useTweenedNumber(delta);
  return (
    <div
      className="mt-4 grid grid-cols-2 gap-3 rounded-xl px-4 py-3.5 border v2-fade-up"
      style={{
        backgroundColor: `color-mix(in oklab, ${accent} 14%, transparent)`,
        borderColor: `color-mix(in oklab, ${accent} 40%, transparent)`,
      }}
    >
      <div>
        <div className="section-label mb-1">Daily target</div>
        {/* SLOE Phase 0: the Daily-target hero numeral reads in the Newsreader
            serif display face (matching the rate numeral above + mobile pace);
            the `kcal` unit stays sans. */}
        <div
          className="font-[family-name:var(--font-display)] text-[22px] font-normal tracking-tight tabular-nums leading-none text-foreground"
          style={{ letterSpacing: "-0.02em" }}
        >
          {Math.round(tweenedTarget).toLocaleString()}
          <span className="font-sans text-xs text-muted-foreground font-medium ml-1">
            kcal
          </span>
        </div>
      </div>
      <div>
        <div className="section-label mb-1">vs. your TDEE</div>
        {/* SLOE Phase 0: the vs-TDEE hero numeral reads in the Newsreader serif
            display face; the `kcal / day` unit stays sans. */}
        <div
          className="font-[family-name:var(--font-display)] text-[22px] font-normal tracking-tight tabular-nums leading-none"
          style={{ letterSpacing: "-0.02em", color: accent }}
        >
          {sign}
          {Math.round(tweenedDelta).toLocaleString()}
          <span className="font-sans text-xs text-muted-foreground font-medium ml-1">
            kcal / day
          </span>
        </div>
      </div>
    </div>
  );
}

function PaceWarningBanner({
  warning,
  acknowledged,
  onAcknowledgeChange,
}: {
  warning: NonNullable<ReturnType<typeof useOnboarding>["warning"]>;
  acknowledged: boolean;
  onAcknowledgeChange: (next: boolean) => void;
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
      className="mt-4 px-3.5 py-3 rounded-xl border flex gap-3 items-start v2-fade-up"
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
        {warning.level === "danger" && (
          <button
            type="button"
            onClick={() => onAcknowledgeChange(!acknowledged)}
            role="checkbox"
            aria-checked={acknowledged}
            aria-label="I understand and accept responsibility for proceeding below the safety floor"
            data-testid="pace-danger-acknowledge"
            className="mt-3 flex items-start gap-2 cursor-pointer select-none w-full text-left bg-transparent border-0 p-0 group"
          >
            <span
              aria-hidden
              className="mt-0.5 inline-grid place-items-center size-[18px] rounded-[5px] border-[1.5px] transition-pm shrink-0 group-active:scale-95"
              style={{
                borderColor: acknowledged
                  ? "var(--destructive)"
                  : "var(--radio-border)",
                backgroundColor: acknowledged
                  ? "var(--destructive)"
                  : "transparent",
              }}
            >
              {acknowledged && (
                <Check
                  className="size-3 text-white"
                  strokeWidth={3}
                  style={{ animation: "v2-check-in 180ms cubic-bezier(0.22,1,0.36,1)" }}
                />
              )}
            </span>
            <span className="text-[13px] font-medium text-foreground leading-snug">
              I understand this is below the recommended safety floor
              and accept responsibility for proceeding.
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
