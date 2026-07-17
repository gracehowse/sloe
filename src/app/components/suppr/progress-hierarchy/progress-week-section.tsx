"use client";

/**
 * ProgressWeekSection — ENG-1525 §2 (web).
 *
 * Plain flat card that absorbs the legacy Daily Calories card, the Average
 * Adherence card, and the On-target ribbon. Always pinned to the CURRENT
 * week (the period control does not move it).
 *
 *   - Headline reconciles both stats: "82% avg · 5 of 7 days on target" —
 *     the adherence average and the on-target count are different numbers;
 *     show both, never conflate. Numeral DEMOTED to the 28px serif step
 *     (the 40px slot now belongs to the §1 hero).
 *   - Mon–Sun calorie bars adapt the legacy hand-rolled renderer
 *     (testids renamed under the `hierarchy-` prefix, `data-today` kept):
 *     sage under / amber over / muted empty — NEVER red; per-day target
 *     reference line; today boxed (outline), suppressed for past weeks.
 *   - Macro bars reuse `formatMacroAdherenceBar` (the Average Adherence
 *     row grammar): sage on-track / amber over.
 *   - Streak microrow keeps freezes reachable (delta 7): the row is a
 *     press-through to the existing streak surface.
 *
 * Mirror: `apps/mobile/components/progress/hierarchy/ProgressWeekSection`.
 */

import * as React from "react";

import { formatMacroAdherenceBar } from "../../../../lib/nutrition/progressWeekReport";
import { formatAdherenceHeadline } from "../../../../lib/nutrition/adherenceDisplay";
import { SupprCard } from "../../ui/suppr-card";
import { HierarchySectionOverline } from "./hierarchy-section-overline";

export interface WeekSectionDayBar {
  /** ISO date key (YYYY-MM-DD). */
  key: string;
  /** Day label (e.g. "Mon") — first letter renders under the bar. */
  day: string;
  calories: number;
  /** Budget the day was judged against (base + activity bonus, ENG-787). */
  effectiveTarget: number;
}

export interface WeekSectionMacroRow {
  name: "Protein" | "Carbs" | "Fat" | "Fibre";
  pct: number;
  /** Base macro colour token (e.g. `var(--macro-protein)`). */
  color: string;
}

export interface ProgressWeekSectionProps {
  /** Range calorie adherence, nulled under the 3-day story floor. */
  adherencePct: number | null;
  onTargetCount: number;
  /** Current-week per-day bars (`dailyCaloriesData` shape). */
  days: WeekSectionDayBar[];
  /** Today's date key; null suppresses today emphasis (past weeks). */
  todayKey: string | null;
  macros: WeekSectionMacroRow[];
  streakDays: number;
  freezesAvailable: number;
  /** Press-through to the existing streak surface (freezes stay reachable). */
  onOpenStreak?: () => void;
  className?: string;
}

/** Trailing consecutive on-target days ending at today (or the last past day). */
function onTargetRunning(days: WeekSectionDayBar[], todayKey: string | null): number {
  const past = todayKey ? days.filter((d) => d.key <= todayKey) : days;
  let run = 0;
  for (let i = past.length - 1; i >= 0; i--) {
    const d = past[i]!;
    if (d.calories > 0 && d.calories <= d.effectiveTarget) run += 1;
    else break;
  }
  return run;
}

function WeekBars({
  days,
  todayKey,
}: {
  days: WeekSectionDayBar[];
  todayKey: string | null;
}) {
  const chartHeight = 96;
  const markReserve = 10;
  const barMax = chartHeight * 0.72;
  const maxCal = Math.max(...days.map((d) => Math.max(d.calories, d.effectiveTarget)), 1);
  const scaleMax = maxCal * 1.15;
  return (
    <div
      className="mt-4 flex items-end gap-2"
      style={{ height: chartHeight }}
      data-testid="hierarchy-week-bars"
    >
      {days.map((d) => {
        const overTarget = d.calories > d.effectiveTarget;
        const barH = Math.max(4, (d.calories / scaleMax) * barMax);
        const targetBottom =
          d.effectiveTarget > 0 ? markReserve + (d.effectiveTarget / scaleMax) * barMax : null;
        const isDayToday = todayKey != null && d.key === todayKey;
        const bg =
          d.calories === 0
            ? "var(--border)"
            : overTarget
              ? "var(--warning)"
              : "var(--macro-protein)";
        return (
          <div
            key={d.key}
            className={[
              "relative flex-1 flex flex-col items-center justify-end rounded-md",
              // Today boxed (outline) — replaces the legacy opacity dim.
              isDayToday ? "border border-border" : "",
            ].join(" ")}
            style={{ height: chartHeight }}
          >
            {/* Per-day target reference line (replaces the legacy goal dot). */}
            {targetBottom != null ? (
              <span
                aria-hidden
                className="absolute inset-x-1 h-px bg-muted-foreground opacity-50"
                style={{ bottom: Math.min(targetBottom, chartHeight - 16) }}
              />
            ) : null}
            <div
              className="w-full rounded-md"
              data-testid={`hierarchy-day-bar-${d.key}`}
              data-today={isDayToday ? "true" : "false"}
              style={{ height: barH, background: bg }}
            />
            <span
              className={[
                "mt-1.5 text-[10px] leading-none",
                isDayToday ? "text-foreground font-bold" : "text-muted-foreground font-medium",
              ].join(" ")}
            >
              {d.day.charAt(0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ProgressWeekSection({
  adherencePct,
  onTargetCount,
  days,
  todayKey,
  macros,
  streakDays,
  freezesAvailable,
  onOpenStreak,
  className,
}: ProgressWeekSectionProps) {
  const denominator = days.length > 0 ? days.length : 7;
  // adherence_over_display honesty rule (audit P1-3): >110% flips to the
  // overshoot reading so a big number can never read as a better score.
  const over = adherencePct != null && adherencePct > 110 ? formatAdherenceHeadline(adherencePct) : null;
  const running = onTargetRunning(days, todayKey);

  return (
    <SupprCard padding="lg" className={className} data-testid="progress-hierarchy-week">
      <HierarchySectionOverline label="This week" />

      {/* Demoted serif numeral (28px step) + the reconciled on-target count. */}
      <p className="mt-2 flex items-baseline gap-1.5 flex-wrap" data-testid="hierarchy-week-headline">
        {adherencePct != null ? (
          <span
            className={`font-[family-name:var(--font-headline)] text-[28px] font-medium leading-none tabular-nums ${over ? "text-warning-solid" : "text-foreground"}`}
          >
            {over ? (
              <>
                {over.value}
                <span className="text-[15px]">{over.suffix}</span>
              </>
            ) : (
              <>
                {adherencePct}
                <span className="text-[15px] text-muted-foreground">%</span>
              </>
            )}
          </span>
        ) : null}
        {adherencePct != null ? (
          <span className="text-[13px] text-muted-foreground">avg ·</span>
        ) : null}
        <span className="text-[13px] font-semibold tabular-nums text-foreground">
          {onTargetCount} of {denominator} days on target
        </span>
      </p>

      <WeekBars days={days} todayKey={todayKey} />

      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--macro-protein)" }} />
          On target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--warning)" }} />
          Over
        </span>
      </div>

      {/* Macro rows — Average Adherence bar grammar (sage / amber-over). */}
      <div className="mt-5 space-y-4">
        {macros.map(({ name, pct, color }) => {
          const bar = formatMacroAdherenceBar({ adherencePct: pct });
          const toneVar = bar.isOver ? "var(--warning)" : color;
          return (
            <div key={name} data-testid={`hierarchy-week-macro-${name.toLowerCase()}`}>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-foreground">{name}</span>
                <span className="text-[13px] font-semibold tabular-nums text-foreground">
                  {bar.label}
                  {bar.isOver ? (
                    <span className="text-muted-foreground font-normal"> · over</span>
                  ) : null}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${bar.barFillPct}%`, background: toneVar }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Streak microrow — texture, and the press-through that keeps
          freezes reachable (delta 7). Omitted at zero: no fabricated texture. */}
      {streakDays > 0 ? (
        <button
          type="button"
          data-testid="hierarchy-week-streak"
          onClick={onOpenStreak}
          disabled={!onOpenStreak}
          className="mt-4 -mx-2 flex w-[calc(100%+16px)] items-center justify-between rounded-lg px-2 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
        >
          <span className="tabular-nums">
            {streakDays}-day streak
            {running > 0 ? ` · on-target ${running} day${running === 1 ? "" : "s"} running` : ""}
            {freezesAvailable > 0
              ? ` · ${freezesAvailable} freeze${freezesAvailable === 1 ? "" : "s"}`
              : ""}
          </span>
          {onOpenStreak ? <span aria-hidden>›</span> : null}
        </button>
      ) : null}
    </SupprCard>
  );
}

export default ProgressWeekSection;
