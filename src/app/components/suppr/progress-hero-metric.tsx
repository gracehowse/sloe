"use client";

/**
 * ProgressHeroMetric — Oura-style "one big thing" at the top of Progress.
 *
 * ENG-616: single dominant metric with ring gauge showing calorie
 * adherence for the selected time range. Sits above the range picker
 * so the user sees their story at a glance.
 *
 * Mirror: `apps/mobile/components/progress/ProgressHeroMetric.tsx`.
 */

export interface ProgressHeroMetricProps {
  adherencePct: number | null;
  avgCaloriesPerDay: number | null;
  targetCalories: number;
  daysLogged: number;
  streak: number;
}

const RING_SIZE = 120;
const STROKE = 8;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function adherenceTone(pct: number): {
  ring: string;
  gradientId: string;
  text: string;
  label: string;
} {
  if (pct >= 90 && pct <= 110) {
    return { ring: "var(--success)", gradientId: "url(#prog-grad-success)", text: "text-success", label: "On target" };
  }
  if (pct < 90) {
    return { ring: "var(--warning)", gradientId: "url(#prog-grad-warning)", text: "text-warning", label: "Under target" };
  }
  // Over-target (>110%) is WARNING AMBER. Canonical 2026-05-22 v2 —
  // anti-MFP brand: over-budget is a gentle nudge, not an alarm.
  // Reverted from the 2026-05-05 "destructive red" rule. Memory updated.
  return { ring: "var(--warning)", gradientId: "url(#prog-grad-over)", text: "text-warning", label: "Over target" };
}

export function ProgressHeroMetric({
  adherencePct,
  avgCaloriesPerDay,
  targetCalories,
  daysLogged,
  streak,
}: ProgressHeroMetricProps) {
  if (adherencePct == null || daysLogged === 0) {
    return (
      <div
        data-testid="progress-hero-metric"
        className="flex flex-col items-center py-8 mb-4 rounded-2xl border border-border bg-card"
      >
        <div
          className="flex items-center justify-center rounded-2xl bg-primary/10"
          style={{ width: 56, height: 56, marginBottom: 16 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <p className="text-[15px] font-semibold text-foreground">Your score builds over time</p>
        <p className="text-sm text-muted-foreground mt-1 text-center" style={{ maxWidth: 280 }}>
          Log meals on Today and we&apos;ll show how closely you&apos;re hitting your targets.
        </p>
      </div>
    );
  }

  const clamped = Math.min(adherencePct, 150);
  const fillPct = Math.min(clamped / 100, 1);
  const offset = CIRCUMFERENCE * (1 - fillPct);
  const tone = adherenceTone(adherencePct);

  return (
    <div
      data-testid="progress-hero-metric"
      className="flex flex-col items-center py-6 mb-3 rounded-2xl border border-border bg-card"
    >
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="block -rotate-90"
          aria-hidden
        >
          <defs>
            <linearGradient id="prog-grad-success" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--success)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--success)" />
            </linearGradient>
            <linearGradient id="prog-grad-warning" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--warning)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--warning)" />
            </linearGradient>
            <linearGradient id="prog-grad-over" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--over-budget-fg)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--over-budget-fg)" />
            </linearGradient>
          </defs>
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke="var(--ring-bg, var(--border))"
            strokeWidth={STROKE}
            fill="none"
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={tone.gradientId}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            data-testid="progress-hero-pct"
            className={`text-[28px] font-extrabold tabular-nums leading-none ${tone.text}`}
          >
            {adherencePct}%
          </span>
        </div>
      </div>

      <p className={`mt-2 text-sm font-semibold ${tone.text}`}>
        {tone.label}
      </p>

      <div className="flex gap-6 mt-3 text-xs text-muted-foreground tabular-nums">
        {avgCaloriesPerDay != null && (
          <span>{avgCaloriesPerDay.toLocaleString()} avg/day</span>
        )}
        <span>Target {targetCalories.toLocaleString()}</span>
        {streak > 0 && <span>{streak}-day streak</span>}
      </div>
    </div>
  );
}
