"use client";

import * as React from "react";
import { Flame, Footprints } from "lucide-react";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { todayHealthConnectActiveCaloriesHint } from "../../../lib/copy/today";

/**
 * TodayStepsCard — Steps & active-energy card on the Today screen.
 *
 * Read-only on web — mirrors mobile
 * (`apps/mobile/components/today/TodayActivityCard.tsx`). Figma TD1
 * (`today-activity.html`): Newsreader card title, steps track, hairline
 * divider, active energy row.
 */
export interface TodayStepsCardProps {
  stepsForSelectedDay: number | null;
  dailyStepsGoal: number;
  /** Active energy (kcal) burned this day from Health, or null when
   *  Health hasn't synced anything for this day. */
  activityBurnKcal: number | null;
  dayLabel?: string;
}

export function TodayStepsCard({
  stepsForSelectedDay,
  dailyStepsGoal,
  activityBurnKcal,
  dayLabel = "Today",
}: TodayStepsCardProps) {
  return (
    <div
      // One-treatment elevation (Grace 2026-06-09): page-ground card → soft
      // lift (`card-slab`). Was flat slab.
      className="rounded-card bg-card card-slab p-5"
      data-testid="today-activity-card"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand">
          Steps & activity
        </h3>
        <span className="text-xs text-muted-foreground">{dayLabel}</span>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2.5 text-[15px] text-foreground">
              <Footprints className="h-[18px] w-[18px] text-muted-foreground" aria-hidden />
              Steps
            </span>
            <span className="font-[family-name:var(--font-headline)] text-lg font-medium tabular-nums text-foreground">
              {stepsForSelectedDay != null ? stepsForSelectedDay.toLocaleString() : "—"}
              {stepsForSelectedDay != null ? (
                <span className="font-body text-sm font-normal text-muted-foreground">
                  {" "}/ {dailyStepsGoal.toLocaleString()}
                </span>
              ) : null}
            </span>
          </div>
          {stepsForSelectedDay != null && dailyStepsGoal > 0 ? (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min((stepsForSelectedDay / dailyStepsGoal) * 100, 100)}%`,
                  background:
                    stepsForSelectedDay >= dailyStepsGoal ? "var(--success)" : "var(--primary)",
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="h-px bg-border" />

        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2.5 text-[15px] text-foreground">
            <Flame className="h-[18px] w-[18px] text-[var(--activity)]" aria-hidden />
            Active energy
          </span>
          <span
            className={
              isFeatureEnabled("type_scale_v1")
                ? "font-[family-name:var(--font-headline)] text-lg font-medium tabular-nums text-foreground"
                : "font-[family-name:var(--font-headline)] text-lg font-semibold tabular-nums text-foreground"
            }
          >
            {activityBurnKcal != null ? (
              <>
                {activityBurnKcal.toLocaleString()}
                <span className="font-body text-sm font-normal text-muted-foreground"> kcal</span>
              </>
            ) : (
              "—"
            )}
          </span>
        </div>
        {activityBurnKcal == null ? (
          <p className="text-[11px] text-muted-foreground">
            {todayHealthConnectActiveCaloriesHint()}
          </p>
        ) : null}
      </div>
    </div>
  );
}
