"use client";

/**
 * ProgressAverageAdherence — Sloe Figma `492:2` "AVERAGE ADHERENCE" card.
 *
 * Layout (matches the frame):
 *   - Eyebrow "AVERAGE ADHERENCE" (clay) top-left; optional "↗ up N%"
 *     week-over-week trend chip + a 5-dot on-target streak top-right.
 *   - Big serif "94%" (Newsreader, % smaller) left.
 *   - Four labelled macro bars: Protein (sage) / Carbs (clay) /
 *     Fat (amber) / Fibre (teal). Each = label left, value right
 *     (e.g. "102% · over"), full-width progress bar below.
 *
 * Every number is REAL: the headline % is the range calorie adherence;
 * the dots come from the host's per-day on-target booleans; the macro
 * percentages come from `weekStatsBundle`. The week-over-week trend chip
 * only renders when the host supplies a real delta — we never invent the
 * "up N%" figure (documented data gap until weekly aggregates persist).
 *
 * Over-target macro bars are AMBER (`--warning`), never red — the
 * destructive-red over rule is the calorie-RING carve-out only (every
 * other over-budget signal stays amber per brand tokens + project memory).
 *
 * Mirror: `apps/mobile/components/progress/ProgressAverageAdherence.tsx`.
 */

import { SupprCard } from "../ui/suppr-card";
import { formatMacroAdherenceBar } from "../../../lib/nutrition/progressWeekReport";

export interface AdherenceMacroRow {
  name: "Protein" | "Carbs" | "Fat" | "Fibre";
  /** Adherence percentage (0..∞). */
  pct: number;
  /** Base macro colour token (e.g. `var(--macro-protein)`). */
  color: string;
}

export interface ProgressAverageAdherenceProps {
  /** Headline calorie adherence percent (range-scoped). Null hides the card. */
  adherencePct: number | null;
  /** Real per-day on-target booleans (sage filled = on target). */
  onTargetDays: boolean[];
  /** Macro adherence rows (Protein/Carbs/Fat/Fibre) — real `weekStatsBundle`. */
  macros: AdherenceMacroRow[];
  /**
   * Week-over-week adherence delta (percentage points). Positive → "↗ up N%".
   * Null/0 hides the chip — never fabricated.
   */
  adherenceDeltaPct?: number | null;
  className?: string;
}

function OnTargetStreakDots({ days }: { days: boolean[] }) {
  if (days.length === 0) return null;
  return (
    <div
      className="flex items-center gap-1.5"
      data-testid="progress-adherence-streak-dots"
      aria-label={`${days.filter(Boolean).length} of ${days.length} days on target`}
    >
      {days.map((on, i) => (
        <span
          key={i}
          className="block rounded-full"
          style={{
            width: 9,
            height: 9,
            background: on ? "var(--macro-protein)" : "var(--border)",
          }}
        />
      ))}
    </div>
  );
}

export function ProgressAverageAdherence({
  adherencePct,
  onTargetDays,
  macros,
  adherenceDeltaPct,
  className,
}: ProgressAverageAdherenceProps) {
  if (adherencePct == null) return null;
  return (
    <SupprCard
      data-testid="progress-average-adherence-card"
      padding="lg"
      radius="lg"
      className={className}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary-solid">
          Average Adherence
        </p>
        <div className="flex items-center gap-2.5">
          {adherenceDeltaPct != null && adherenceDeltaPct !== 0 ? (
            <span
              data-testid="progress-adherence-trend-chip"
              className={[
                "inline-flex items-center gap-1 text-[12px] font-medium tabular-nums",
                adherenceDeltaPct > 0 ? "text-success" : "text-muted-foreground",
              ].join(" ")}
            >
              <span aria-hidden>{adherenceDeltaPct > 0 ? "↗" : "↘"}</span>
              {adherenceDeltaPct > 0 ? "up" : "down"} {Math.abs(adherenceDeltaPct)}%
            </span>
          ) : null}
          <OnTargetStreakDots days={onTargetDays} />
        </div>
      </div>

      <p
        data-testid="progress-adherence-pct"
        className="mt-1 font-[family-name:var(--font-headline)] text-[40px] font-medium leading-none text-foreground tabular-nums"
      >
        {adherencePct}
        <span className="text-[22px] text-muted-foreground">%</span>
      </p>

      <div className="mt-4 space-y-3">
        {macros.map(({ name, pct, color }) => {
          const bar = formatMacroAdherenceBar({ adherencePct: pct });
          const tone = bar.isOver ? "var(--warning)" : color;
          return (
            <div key={name} data-testid={`progress-adherence-macro-${name.toLowerCase()}`}>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-foreground">{name}</span>
                <span
                  className="text-[13px] font-semibold tabular-nums text-foreground"
                  data-testid={`progress-adherence-macro-value-${name.toLowerCase()}`}
                >
                  {bar.label}
                  {bar.isOver ? (
                    <span className="text-muted-foreground font-normal"> · over</span>
                  ) : null}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  data-testid={`progress-adherence-bar-${name.toLowerCase()}`}
                  style={{ width: `${bar.barFillPct}%`, background: tone }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </SupprCard>
  );
}

export default ProgressAverageAdherence;
