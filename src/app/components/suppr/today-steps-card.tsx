"use client";

import * as React from "react";
import { Icons } from "../ui/icons";
import { IconBox } from "../ui/icon-box";

/**
 * TodayStepsCard — Steps & active-energy card on the Today screen.
 *
 * Read-only on web — mirrors mobile
 * (`apps/mobile/components/today/TodayActivityCard.tsx`). Steps + active
 * energy come from Apple Health (or Google Fit on Android, future)
 * via the mobile app's HealthKit sync, which writes to
 * `profiles.steps_by_day` / `profiles.activity_burn_by_day`. Web reads
 * those columns and displays them — there's no manual entry path
 * because web has no Health source of its own (decision 2026-04-18).
 *
 * Layout matches the mobile card: Steps row with progress bar, then a
 * divider, then Active energy row.
 */
export interface TodayStepsCardProps {
  stepsForSelectedDay: number | null;
  dailyStepsGoal: number;
  /** Active energy (kcal) burned this day from Health, or null when
   *  Health hasn't synced anything for this day. */
  activityBurnKcal: number | null;
}

export function TodayStepsCard({
  stepsForSelectedDay,
  dailyStepsGoal,
  activityBurnKcal,
}: TodayStepsCardProps) {
  return (
    <div className="rounded-card bg-card border border-border p-3 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <IconBox size="sm" tone="primary">
          <Icons.activity />
        </IconBox>
        <span className="text-xs font-semibold text-foreground">Steps & activity</span>
      </div>

      {/* Steps row */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-foreground">Steps</span>
        <span className="text-base font-extrabold tabular-nums text-foreground">
          {stepsForSelectedDay != null ? stepsForSelectedDay.toLocaleString() : "—"}
          {stepsForSelectedDay != null ? (
            <span className="text-xs font-semibold text-muted-foreground"> / {dailyStepsGoal.toLocaleString()}</span>
          ) : null}
        </span>
      </div>
      {stepsForSelectedDay != null && dailyStepsGoal > 0 ? (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min((stepsForSelectedDay / dailyStepsGoal) * 100, 100)}%`,
              background: stepsForSelectedDay >= dailyStepsGoal ? "var(--success)" : "var(--primary)",
            }}
          />
        </div>
      ) : null}

      <div className="h-px bg-border my-2" />

      {/* Active energy row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">Active energy</span>
        <span className="text-base font-extrabold tabular-nums text-foreground">
          {activityBurnKcal != null ? `${activityBurnKcal.toLocaleString()} kcal` : "—"}
        </span>
      </div>
      {activityBurnKcal == null ? (
        <p className="text-[11px] text-muted-foreground mt-1">
          Active calories appear here once a source is connected from the iOS app.
        </p>
      ) : null}
    </div>
  );
}
