"use client";

import * as React from "react";
import { CircleCheck, Sparkles, TrendingUp } from "lucide-react";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import {
  weeklyInsightCoachLine,
  weeklyInsightHeadline,
} from "../../../lib/copy/today";
import {
  computeDaysOnTarget,
  computeWeekBarStates,
} from "../../../lib/nutrition/weekInsightBar";
import { SupprCard } from "../ui/suppr-card.tsx";
import { PROGRESS_INSIGHT_LILAC_STYLE } from "./progress-headline.tsx";

/**
 * Below-meals weekly insight on mobile-web — parity with
 * `apps/mobile/components/today/WeeklyInsightCard.tsx` (TD3).
 */
export interface TodayWeeklyInsightMobileCardProps {
  householdSize: number;
  loggedDaysInWeek: number;
  weekAvgKcal: number | null;
  weekDailyKcal: number[];
  dailyKcalTarget: number;
}

export function TodayWeeklyInsightMobileCard({
  householdSize,
  loggedDaysInWeek,
  weekAvgKcal,
  weekDailyKcal,
  dailyKcalTarget,
}: TodayWeeklyInsightMobileCardProps) {
  // Hooks must run unconditionally (react-hooks/rules-of-hooks): compute
  // these before any feature-flag early return, or eslint errors and the
  // hook order changes between the flag-on / flag-off renders.
  const dayStates = React.useMemo(
    () => computeWeekBarStates(weekDailyKcal, dailyKcalTarget),
    [weekDailyKcal, dailyKcalTarget],
  );
  const onTargetDays = React.useMemo(
    () => computeDaysOnTarget(weekDailyKcal, dailyKcalTarget),
    [weekDailyKcal, dailyKcalTarget],
  );

  const figmaLayout = isFeatureEnabled("today_meals_figma_654");
  if (!isFeatureEnabled("today-weekly-insight-mobile") && !figmaLayout) return null;

  const headline = weeklyInsightHeadline(loggedDaysInWeek, onTargetDays);
  const coachLine = weeklyInsightCoachLine(loggedDaysInWeek, onTargetDays);

  const loggedLine =
    loggedDaysInWeek === 0
      ? "Log a meal to start the week."
      : loggedDaysInWeek === 1
        ? "1 day logged so far."
        : `${loggedDaysInWeek} days logged so far.`;

  const proseBody =
    coachLine ??
    (loggedDaysInWeek === 0
      ? loggedLine
      : weekAvgKcal != null
        ? `${loggedLine} ${Math.round(weekAvgKcal).toLocaleString()} kcal daily average.`
        : loggedLine);

  if (figmaLayout) {
    return (
      // Flat `SupprCard` slab — same chrome as the other resting Today cards.
      // The CROSS-SCREEN insight lilac (`PROGRESS_INSIGHT_LILAC_STYLE` =
      // `var(--slot-dinner-soft)`, the exact wash the Progress THIS WEEK card
      // uses) carries the "insight = lilac" language on Today too, but now as a
      // borderless flat slab (the old `rounded-xl border border-border` +
      // cooler `--frost-mist` ad-hoc fill are gone, 2026-06-08 flat-slab
      // unification — parity with mobile `tone="magenta"`). To make Today's
      // insight cream-neutral like the rest of Today, drop the `style` lilac
      // (one founder decision; see the card report). `slab-flat` already drops
      // the border, so the lilac border in the style is inert here.
      <SupprCard
        elevation="card"
        radius="lg"
        padding="xl"
        className="md:hidden mb-4"
        style={PROGRESS_INSIGHT_LILAC_STYLE}
        data-testid="today-weekly-insight-mobile"
        aria-label="Weekly insight"
      >
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-lg border border-border/50 bg-card p-2 shadow-sm text-foreground-brand">
            <TrendingUp className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h4 className="font-[family-name:var(--font-headline)] text-lg text-foreground-brand mb-1">
              Weekly Insight
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {proseBody}
            </p>
          </div>
        </div>
      </SupprCard>
    );
  }

  return (
    // Cross-screen insight lilac (matches Progress THIS WEEK); flat slab keeps
    // it borderless. Drop the `style` lilac for cream-neutral (see card report).
    <SupprCard
      elevation="card"
      radius="lg"
      padding="lg"
      className="md:hidden mb-3"
      style={PROGRESS_INSIGHT_LILAC_STYLE}
      data-testid="today-weekly-insight-mobile"
      aria-label="Weekly insight"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary-solid" aria-hidden />
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary-solid">
          Weekly insight
        </span>
      </div>

      <h3 className="font-[family-name:var(--font-headline)] text-[18px] font-medium leading-snug text-foreground-brand mb-2">
        {headline}
      </h3>

      {householdSize > 0 ? (
        <p className="text-[11px] text-muted-foreground mb-4">
          {householdSize === 1
            ? "Planning for you this week"
            : `Planning for ${householdSize} this week`}
        </p>
      ) : null}

      <div className="grid grid-cols-3 mb-4">
        <StatCell value={`${loggedDaysInWeek} / 7`} label="Days logged" />
        <StatCell
          value={weekAvgKcal != null ? Math.round(weekAvgKcal).toLocaleString() : "—"}
          label="Avg intake"
          divider
        />
        <StatCell
          value={
            dailyKcalTarget > 0 && loggedDaysInWeek > 0
              ? `${onTargetDays} day${onTargetDays === 1 ? "" : "s"}`
              : "—"
          }
          label="On target"
          divider
        />
      </div>

      <div
        className="flex gap-1.5 mb-4"
        role="img"
        aria-label={
          loggedDaysInWeek === 0
            ? "No meals logged this week yet."
            : `${loggedDaysInWeek} days logged this week, ${onTargetDays} on target.`
        }
      >
        {dayStates.map((state, i) => (
          <div
            key={i}
            className="h-2 flex-1 rounded-full"
            style={{
              background:
                state === "onTarget"
                  ? "var(--primary)"
                  : state === "loggedOff"
                    ? "color-mix(in srgb, var(--primary) 40%, transparent)"
                    : "var(--border)",
            }}
          />
        ))}
      </div>

      {coachLine ? (
        <div className="flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-success shrink-0" aria-hidden />
          <p className="text-[11px] text-muted-foreground">{coachLine}</p>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {loggedLine}
          {weekAvgKcal != null ? (
            <>
              {" "}
              <span className="font-semibold text-foreground">
                {Math.round(weekAvgKcal).toLocaleString()} kcal
              </span>{" "}
              daily average.
            </>
          ) : null}
        </p>
      )}
    </SupprCard>
  );
}

function StatCell({
  value,
  label,
  divider,
}: {
  value: string;
  label: string;
  divider?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center text-center px-1 ${divider ? "border-l border-border" : ""}`}
    >
      <span className="font-[family-name:var(--font-headline)] text-[18px] font-medium tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">
        {label}
      </span>
    </div>
  );
}
