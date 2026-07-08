"use client";

import * as React from "react";
import { formatKcalDisplay } from "../../../lib/nutrition/formatMacro";
import { isFeatureEnabled } from "../../../lib/analytics/track";

/**
 * TodayWeekSummaryStats — the "Weekly summary" tile trio (Total kcal / Daily
 * avg / Net deficit-surplus) on `TodayWeekView`. Extracted out of that file
 * (ENG-1372 slice 2) so the sparse-stats addition didn't push the pinned
 * 457-line host over its `scripts/screen-line-budget.json` ceiling.
 *
 * ENG-1372 slice 2 (law 3) — an average from <3 data points is a derived
 * stat with nothing behind it yet ("929 avg" from one logged day reads as a
 * real week average). Below 3 logged days, the middle tile suppresses
 * "Daily avg" and shows the honest stat instead: how many of the 7 days
 * actually have data ("{n}/7 days logged"). Folded onto the SAME
 * `empty_state_grammar_v1` flag slice 1 shipped — no new flag.
 *
 * Mobile parity: `apps/mobile/components/today/TodayWeekSummaryStats.tsx`.
 */
export interface TodayWeekSummaryStatsProps {
  totalCalories: number;
  avgCalories: number;
  loggedDaysInWeek: number;
  /** true when burn >= consumed (deficit); false = surplus. */
  isDeficit: boolean;
  /** abs(burnReference - weekTotals.calories), pre-rounded by the caller. */
  deficitOrSurplusDiff: number;
}

export function TodayWeekSummaryStats({
  totalCalories,
  avgCalories,
  loggedDaysInWeek,
  isDeficit,
  deficitOrSurplusDiff,
}: TodayWeekSummaryStatsProps) {
  const showDaysLogged = loggedDaysInWeek < 3 && isFeatureEnabled("empty_state_grammar_v1");
  return (
    <div className="rounded-card bg-card card-slab p-4">
      <p className="text-sm font-semibold text-foreground mb-3">Weekly summary</p>
      <div className="flex justify-around text-center">
        {/* SLOE Phase 0: the weekly-summary big stat numerals read in the
            Newsreader serif display face (the design system reserves big
            numerals for serif); labels stay sans. Mirrors mobile TodayWeekView. */}
        <div>
          <p className="font-[family-name:var(--font-headline)] text-2xl font-medium text-foreground tabular-nums">
            {formatKcalDisplay(totalCalories)}
          </p>
          <p className="text-[11px] text-muted-foreground">Total kcal</p>
        </div>
        <div>
          {showDaysLogged ? (
            <>
              <p
                data-testid="today-week-days-logged-stat"
                className="font-[family-name:var(--font-headline)] text-2xl font-medium text-primary-solid tabular-nums"
              >
                {loggedDaysInWeek}/7
              </p>
              <p className="text-[11px] text-muted-foreground">Days logged</p>
            </>
          ) : (
            <>
              <p className="font-[family-name:var(--font-headline)] text-2xl font-medium text-primary-solid tabular-nums">
                {formatKcalDisplay(avgCalories)}
              </p>
              <p className="text-[11px] text-muted-foreground">Daily avg</p>
            </>
          )}
        </div>
        <div>
          {/* User-sentiment audit (round 4, 2026-04-30): replaced the
              punitive over/under-target labels with the canonical
              "Net deficit"/"Net surplus" phrasing from
              `src/lib/copy/today.ts`. UCL Oct 2025 study + r/loseit
              data show that judgmental framing drives logging
              avoidance; "deficit"/"surplus" reads as observation,
              not judgment. Green for under-target, red for
              over-target — clear at-a-glance signal. */}
          <p className={`font-[family-name:var(--font-headline)] text-2xl font-medium tabular-nums ${isDeficit ? "text-success" : "text-destructive"}`}>
            {deficitOrSurplusDiff}
          </p>
          <p className="text-[11px] text-muted-foreground">{isDeficit ? "Net deficit" : "Net surplus"}</p>
        </div>
      </div>
    </div>
  );
}

export default TodayWeekSummaryStats;
