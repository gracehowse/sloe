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
 * "up N%" figure (deferred: see ENG-741 weekly aggregate stream — the host
 * can't pass `adherenceDeltaPct` until weekly aggregates persist; the chip
 * fills the top-right slot beside the dots once it lands).
 *
 * Over-target macro bars are AMBER (`--warning`), never red — the
 * destructive-red over rule is the calorie-RING carve-out only (every
 * other over-budget signal stays amber per brand tokens + project memory).
 *
 * Mirror: `apps/mobile/components/progress/ProgressAverageAdherence.tsx`.
 */

import { SupprCard } from "../ui/suppr-card";
import { formatMacroAdherenceBar } from "../../../lib/nutrition/progressWeekReport";
import { formatAdherenceHeadline } from "../../../lib/nutrition/adherenceDisplay";
import { isFeatureEnabled } from "../../../lib/analytics/track";

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
  // ENG-1006 — suppressed when no day is on target (not just when the
  // array is empty), mirroring `<ProgressOnTargetRibbon>`'s "don't show
  // an empty achievement" rule. A row of empty grey dots next to a >100%
  // headline read as broken/placeholder chrome — the dots are this-week-
  // scoped while the headline is range-scoped, so the two can legitimately
  // disagree. With nothing to celebrate, render nothing.
  if (days.filter(Boolean).length === 0) return null;
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
  // `adherence_over_display` (audit P1-3): above the 110% band the headline
  // flips to an overshoot reading ("11% over") so a >100% number can never
  // read as a *better* score. The flag gates ONLY the over branch; the
  // ≤110% (on/under) path is identical to today's raw `{pct}%`, so a flag
  // flicker can't change a healthy user's number. Mirror: mobile.
  const overDisplay =
    isFeatureEnabled("adherence_over_display") &&
    adherencePct > 110
      ? formatAdherenceHeadline(adherencePct)
      : null;
  return (
    <SupprCard
      data-testid="progress-average-adherence-card"
      // One-card-treatment soft lift (2026-06-09): page-ground content card →
      // soft `.card-slab`. Mirrors mobile `lift="soft"`.
      elevation="card"
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
                "inline-flex items-center gap-1 text-[11px] font-medium tabular-nums",
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

      {/* ENG-996 — vertical rhythm snapped to the spacing scale so the
          headline / big % / macro-bar list read with the same calm
          cadence as the sibling cards. Was a 4/16/12/6 cascade of
          off-token gaps; now 8 under the overline, 20 hero-break before
          the bars, 16 between rows, 8 label→bar. Mirror: mobile
          `ProgressAverageAdherence.tsx`. */}
      {overDisplay ? (
        // adherence_over_display ON + over target: band-inverted overshoot
        // headline ("11% over"), amber not the triumphant raw "111%". The
        // amber tone matches the macro-bar over treatment (warning token),
        // NOT the destructive-red ring carve-out. Mirror: mobile.
        <p
          data-testid="progress-adherence-pct"
          className="mt-2 font-[family-name:var(--font-headline)] text-[40px] font-medium leading-none text-warning tabular-nums"
        >
          {overDisplay.value}
          <span className="text-[22px] text-warning/70">{overDisplay.suffix}</span>
        </p>
      ) : (
        <p
          data-testid="progress-adherence-pct"
          className="mt-2 font-[family-name:var(--font-headline)] text-[40px] font-medium leading-none text-foreground tabular-nums"
        >
          {adherencePct}
          <span className="text-[22px] text-muted-foreground">%</span>
          {/* >100% means "over budget on average" — same "· over" qualifier
              as the macro rows (mirror of mobile; fresh-eyes P0-2). */}
          {adherencePct > 100 ? (
            <span className="text-[15px] font-normal text-muted-foreground"> · over</span>
          ) : null}
        </p>
      )}

      <div className="mt-5 space-y-4">
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
              {/* §7.3 — adherence-bar track 4–6pt; h-1.5 (6px) keeps the
                  fill legible while reading lighter than the prior h-2 (8px)
                  full-width x4 stack (less "tracker dashboard"). */}
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
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
