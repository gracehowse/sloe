"use client";

import * as React from "react";
import { TrendingUp } from "lucide-react";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { weeklyInsightCoachLine } from "../../../lib/copy/today";
import { computeDaysOnTarget } from "../../../lib/nutrition/weekInsightBar";
import { SupprNotice } from "../ui/suppr-notice";

/**
 * Below-meals weekly insight on mobile-web — parity with
 * `apps/mobile/components/today/WeeklyInsightCard.tsx` (TD3).
 *
 * §3 (web parity 2026-06-10, ENG-1022): de-carded. On the inverted §1
 * material (`--background #FBF8F3` / `--card #FFFFFF`) the filled lilac slab
 * read as the odd muddy box between white gallery cards — the same finding
 * that drove the mobile de-card. The insight is now a typographic callout
 * sitting directly on the page ground: a small uppercase eyebrow row
 * (TrendingUp + "WEEKLY INSIGHT" in `text-primary-solid`) + a prose line in
 * `text-muted-foreground`. Content over chrome. The stat grid + 7-segment
 * week bar are dropped (the eyebrow + prose line carry the insight, matching
 * the mobile callout); every figure remains derived from log data — no
 * fabrication. Testid `today-weekly-insight-mobile` is preserved.
 */
export interface TodayWeeklyInsightMobileCardProps {
  householdSize: number;
  loggedDaysInWeek: number;
  weekAvgKcal: number | null;
  weekDailyKcal: number[];
  dailyKcalTarget: number;
}

export function TodayWeeklyInsightMobileCard({
  householdSize: _householdSize,
  loggedDaysInWeek,
  weekAvgKcal,
  weekDailyKcal,
  dailyKcalTarget,
}: TodayWeeklyInsightMobileCardProps) {
  void _householdSize;
  // Hooks must run unconditionally (react-hooks/rules-of-hooks): compute
  // before any feature-flag early return.
  const onTargetDays = React.useMemo(
    () => computeDaysOnTarget(weekDailyKcal, dailyKcalTarget),
    [weekDailyKcal, dailyKcalTarget],
  );

  const figmaLayout = isFeatureEnabled("today_meals_figma_654");
  if (!isFeatureEnabled("today-weekly-insight-mobile") && !figmaLayout) return null;

  const coachLine = weeklyInsightCoachLine(loggedDaysInWeek, onTargetDays);

  const loggedLine =
    loggedDaysInWeek === 0
      ? "Log a meal to start the week."
      : loggedDaysInWeek === 1
        ? "1 day logged so far."
        : `${loggedDaysInWeek} days logged so far.`;

  // Prose body — honest, derived. Exact parity with the mobile
  // `WeeklyInsightCard` figma branch: prefer the coach line; otherwise the
  // logged-count summary (+ daily average when present). weekAvgKcal is null
  // when no day is logged, so we never show "0 kcal".
  const proseBody =
    coachLine ??
    (loggedDaysInWeek === 0
      ? loggedLine
      : weekAvgKcal != null
        ? `${loggedLine} ${Math.round(weekAvgKcal).toLocaleString()} kcal daily average.`
        : loggedLine);

  const insightBody = (
    <>
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-primary-solid" strokeWidth={2} aria-hidden />
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary-solid">
          Weekly insight
        </span>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{proseBody}</p>
    </>
  );

  if (isFeatureEnabled("ui_anatomy_owners_v1")) {
    return (
      <SupprNotice
        tone="primary"
        variant="inline"
        data-testid="today-weekly-insight-mobile"
        aria-label="Weekly insight"
        className="md:hidden mb-4"
      >
        {insightBody}
      </SupprNotice>
    );
  }

  return (
    // De-carded typographic callout — sits directly on the cream page ground
    // (no card chrome), mobile-web only (`md:hidden`). Mirrors the mobile
    // `WeeklyInsightCard` figma branch.
    <div
      data-testid="today-weekly-insight-mobile"
      aria-label="Weekly insight"
      className="md:hidden mb-4 px-1 flex flex-col gap-1.5"
    >
      {insightBody}
    </div>
  );
}
