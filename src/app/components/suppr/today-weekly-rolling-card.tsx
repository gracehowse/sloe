"use client";

import { TrendingUp } from "lucide-react";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { WEEKLY_ROLLING_DENOMINATOR_HINT } from "../../../lib/copy/today";
import { weekSummaryHeading, type WeekSummaryMode } from "../../../lib/nutrition/weekSummaryWindow";

/**
 * TodayWeeklyRollingCard — the 7-day rolling deficit/surplus rollup card.
 * Extracted verbatim from `today-activity-bonus-card.tsx` (ENG-1506 touch)
 * to keep that pinned file under its line budget; all values are
 * host-computed and passed down, so this stays pure presentation. Mobile
 * twin: `apps/mobile/components/today/TodayWeeklyRollingCard.tsx`.
 */
const LABEL_CLASS =
  "text-[10px] font-medium uppercase tracking-wide text-muted-foreground";

export function TodayWeeklyRollingCard({
  weekSummaryMode,
  weekConsumed,
  isWeekDeficit,
  dailyAvgDeficit,
  weekDeficit,
  weeklyMassLabel,
}: {
  weekSummaryMode: WeekSummaryMode;
  weekConsumed: number;
  isWeekDeficit: boolean;
  dailyAvgDeficit: number;
  weekDeficit: number;
  weeklyMassLabel: string;
}) {
  const isCalibrating = weekConsumed === 0;
  const valueClasses = isCalibrating
    ? "text-muted-foreground"
    : isWeekDeficit
      ? "text-[var(--success)]"
      : "text-[var(--accent-warning-solid)]";
  // type_scale_v1 (visible-resize): text-base → text-lg, the T4 in-card
  // row-numeral register, matching steps-card rows; off = legacy text-base
  // (kill switch).
  const typeScaleV1 = isFeatureEnabled("type_scale_v1");
  const rowValueSizeClass = typeScaleV1 ? "text-lg" : "text-base";
  const rows: { label: string; value: string }[] = [
    {
      label: `Avg daily ${isWeekDeficit ? "deficit" : "surplus"}`,
      value: `${Math.abs(dailyAvgDeficit).toLocaleString()} kcal`,
    },
    {
      label: `Weekly ${isWeekDeficit ? "deficit" : "surplus"}`,
      value: `${Math.abs(weekDeficit).toLocaleString()} kcal`,
    },
    {
      label: `Projected weekly ${isWeekDeficit ? "loss" : "gain"}`,
      value: weeklyMassLabel,
    },
  ];
  return (
    <div
      // One-treatment elevation (Grace 2026-06-09): page-ground card → soft
      // lift (`card-slab`). Was flat slab.
      className="rounded-card bg-card card-slab p-5"
      data-testid="today-weekly-rolling-card"
    >
      <div className="mb-3 flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-[var(--success)]" aria-hidden />
        <span className={LABEL_CLASS}>{weekSummaryHeading(weekSummaryMode)}</span>
      </div>
      <div className="space-y-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-muted-foreground">{row.label}</span>
            <span
              className={`font-[family-name:var(--font-headline)] ${rowValueSizeClass} font-medium tabular-nums ${valueClasses}`}
            >
              {row.value}
            </span>
          </div>
        ))}
        <p className="text-xs text-muted-foreground leading-snug pt-1">
          {WEEKLY_ROLLING_DENOMINATOR_HINT}
        </p>
      </div>
    </div>
  );
}

export default TodayWeeklyRollingCard;
