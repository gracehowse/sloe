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
  /**
   * Sloe Figma 492:2 — per-day on-target booleans for the 7-dot ribbon
   * beside the score (filled sage = on target, hollow line = off/empty).
   * Each entry is a real day from `weekStatsBundle.days`
   * (`calories > 0 && calories <= effectiveTargetCalories`). Optional so
   * legacy callers keep the dot-less hero. Never fabricated — omitted
   * entirely when the host can't supply real days.
   */
  onTargetDays?: boolean[];
  /**
   * Sloe Figma 492:2 — week-over-week adherence delta (percentage
   * points). Positive renders the sage "up N%" trend chip; negative
   * renders "down N%"; null/zero hides the chip. Real value from the
   * host's range stats — never invented.
   */
  adherenceDeltaPct?: number | null;
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
    // Under target — calm sage, mirroring mobile (`Accent.success` for the
    // under case). Not an alarm; the user simply hasn't filled the budget.
    return { ring: "var(--success)", gradientId: "url(#prog-grad-success)", text: "text-success", label: "Under target" };
  }
  // Over-target (>110%) — AMBER warning family (ENG-1296, 2026-07-01
  // re-ratification: the dossier D-2 destructive-red carve-out is RETIRED;
  // over-budget signals product-wide are uniformly amber). Ring stroke =
  // fill amber `--warning`; text = `text-warning-solid` (the AA amber text
  // token — base amber fails as text). Mirrors mobile `Accent.warning`.
  return { ring: "var(--warning)", gradientId: "url(#prog-grad-over)", text: "text-warning-solid", label: "Over target" };
}

import { SupprCard } from "../ui/suppr-card";
import { formatAdherenceHeadline } from "../../../lib/nutrition/adherenceDisplay";

/**
 * Sloe Figma 492:2 — 7-dot on-target ribbon. Filled sage dot = a logged
 * day at/under its effective target; hollow `bg-border` dot = off-target
 * or unlogged. Renders exactly the days the host supplies (real data).
 */
function OnTargetDots({ days }: { days: boolean[] }) {
  if (days.length === 0) return null;
  return (
    <div
      className="flex items-center gap-1.5"
      data-testid="progress-hero-ontarget-dots"
      // The ribbon is a single graphic conveying "N of M days on target";
      // role="img" makes the aria-label its text alternative (the dots
      // themselves are decorative) and clears the axe "aria-label on a div
      // with no valid role" rule. (ENG-780 storybook a11y gate.)
      role="img"
      aria-label={`${days.filter(Boolean).length} of ${days.length} days on target`}
    >
      {days.map((on, i) => (
        <span
          key={i}
          className="block rounded-full"
          style={{
            width: 8,
            height: 8,
            background: on ? "var(--success)" : "var(--border)",
          }}
        />
      ))}
    </div>
  );
}

export function ProgressHeroMetric({
  adherencePct,
  avgCaloriesPerDay,
  targetCalories,
  daysLogged,
  streak,
  onTargetDays,
  adherenceDeltaPct,
}: ProgressHeroMetricProps) {
  if (adherencePct == null || daysLogged === 0) {
    return (
      <SupprCard
        data-testid="progress-hero-metric"
        padding="none"
        radius="xl"
        className="flex flex-col items-center py-8 mb-4"
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
      </SupprCard>
    );
  }

  const clamped = Math.min(adherencePct, 150);
  const fillPct = Math.min(clamped / 100, 1);
  const offset = CIRCUMFERENCE * (1 - fillPct);
  const tone = adherenceTone(adherencePct);
  // `adherence_over_display` (audit P1-3): above the 110% band the ring
  // centre-number flips to an overshoot reading ("11% over", amber) so a
  // >100% figure can't read as a *better* score. The flag gates ONLY the
  // over branch; ring fill geometry + the supporting "Over target" label
  // are unchanged, and the ≤110% path is untouched. Else = today's raw
  // red `{pct}%` centre. Mirror: mobile.
  const overDisplay =
    adherencePct > 110 ? formatAdherenceHeadline(adherencePct) : null;

  return (
    <SupprCard
      data-testid="progress-hero-metric"
      padding="none"
      radius="xl"
      className="flex flex-col items-center py-6 mb-3"
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
            {/* Over-target adherence ring is AMBER (ENG-1296, 2026-07-01
                re-ratification) — the 2026-05-22 "rings go red" carve-out is
                retired; over-budget is the warning family product-wide. */}
            <linearGradient id="prog-grad-over" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--warning)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--warning)" />
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
          {overDisplay ? (
            // Over target: overshoot magnitude with a smaller "over" tag,
            // amber (warning-solid) not the raw "111%" (ENG-1296: never red).
            <span
              data-testid="progress-hero-pct"
              className="flex items-baseline tabular-nums leading-none text-warning-solid"
            >
              <span className="text-[28px] font-extrabold">{overDisplay.value}%</span>
              <span className="ml-0.5 text-[11px] font-semibold">{overDisplay.qualifier}</span>
            </span>
          ) : (
            <span
              data-testid="progress-hero-pct"
              className={`text-[28px] font-extrabold tabular-nums leading-none ${tone.text}`}
            >
              {adherencePct}%
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <p className={`text-sm font-semibold ${tone.text}`}>{tone.label}</p>
        {/* Sloe Figma 492:2 — sage "up N%" / "down N%" week-over-week
            adherence trend chip. Real delta from the host; hidden at 0. */}
        {adherenceDeltaPct != null && adherenceDeltaPct !== 0 ? (
          <span
            data-testid="progress-hero-trend-chip"
            className={[
              "inline-flex items-center gap-1 text-[11px] font-medium tabular-nums",
              adherenceDeltaPct > 0 ? "text-success" : "text-muted-foreground",
            ].join(" ")}
          >
            <span aria-hidden>{adherenceDeltaPct > 0 ? "↑" : "↓"}</span>
            {adherenceDeltaPct > 0 ? "up" : "down"} {Math.abs(adherenceDeltaPct)}%
          </span>
        ) : null}
      </div>

      {/* Sloe Figma 492:2 — on-target days ribbon. Only renders when the
          host supplies real per-day data. */}
      {onTargetDays && onTargetDays.length > 0 ? (
        <div className="mt-3">
          <OnTargetDots days={onTargetDays} />
        </div>
      ) : null}

      <div className="flex gap-6 mt-3 text-xs text-muted-foreground tabular-nums">
        {avgCaloriesPerDay != null && (
          <span>{avgCaloriesPerDay.toLocaleString()} avg/day</span>
        )}
        <span>Target {targetCalories.toLocaleString()}</span>
        {streak > 0 && <span>{streak}-day streak</span>}
      </div>
    </SupprCard>
  );
}
