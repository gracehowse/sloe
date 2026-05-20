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
  text: string;
  label: string;
} {
  if (pct >= 90 && pct <= 110) {
    return { ring: "var(--success)", text: "text-success", label: "On target" };
  }
  if (pct >= 75 && pct <= 125) {
    return { ring: "var(--warning)", text: "text-warning", label: pct < 90 ? "Under target" : "Over target" };
  }
  if (pct < 75) {
    return { ring: "var(--warning)", text: "text-warning", label: "Under target" };
  }
  return { ring: "var(--destructive)", text: "text-destructive", label: "Over target" };
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
        className="flex flex-col items-center py-6 mb-4 rounded-2xl border border-border bg-card"
      >
        <p className="text-sm text-muted-foreground">
          Log meals on Today to see your score here.
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
      className="flex flex-col items-center py-6 mb-4 rounded-2xl border border-border bg-card"
    >
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="block -rotate-90"
          aria-hidden
        >
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
            stroke={tone.ring}
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
