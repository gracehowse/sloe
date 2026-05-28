"use client";

import * as React from "react";
import { Icons } from "../ui/icons";
import { IconBox } from "../ui/icon-box";
import { Badge } from "./badge";

/**
 * TodayStreakInsightCard — streak + freeze insight card.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). All
 * freeze ledger state remains in the host; this card only renders.
 */
export interface TodayStreakInsightCardProps {
  streakDays: number;
  freezesAvailableToday: number;
  hasUnseenFreezeEarned: boolean;
  onDismissFreezeEarned: () => void;
}

export function TodayStreakInsightCard({
  streakDays,
  freezesAvailableToday,
  hasUnseenFreezeEarned,
  onDismissFreezeEarned,
}: TodayStreakInsightCardProps) {
  if (streakDays <= 0) return null;
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-card border border-success/20 bg-success-soft">
      <IconBox size="lg" tone="success">
        <Icons.streak />
      </IconBox>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-success">
          {streakDays}-day logging streak
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          You&apos;ve logged {streakDays} day{streakDays !== 1 ? "s" : ""} in a row.
        </p>
        {freezesAvailableToday > 0 ? (
          <Badge
            variant="freeze"
            ariaLabel={`${freezesAvailableToday} streak freeze${freezesAvailableToday === 1 ? "" : "s"} available`}
            icon={<Icons.streakFreeze />}
            className="mt-1"
          >
            {`${freezesAvailableToday} freeze${freezesAvailableToday === 1 ? "" : "s"} available`}
          </Badge>
        ) : null}
        {hasUnseenFreezeEarned ? (
          <div
            role="status"
            aria-label={`You earned a freeze — ${freezesAvailableToday} available`}
            className="mt-2 flex items-center gap-2 rounded-lg border border-[color:color-mix(in_oklab,var(--macro-water)_35%,transparent)] bg-[color-mix(in_oklab,var(--macro-water)_10%,transparent)] px-2.5 py-1.5"
          >
            <Icons.streakFreeze
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 text-[color:var(--macro-water)]"
            />
            <p className="flex-1 text-[11px] font-medium text-foreground">
              You earned a freeze — {freezesAvailableToday} available
            </p>
            <button
              type="button"
              onClick={onDismissFreezeEarned}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--macro-water)] hover:bg-[color-mix(in_oklab,var(--macro-water)_15%,transparent)]"
            >
              Got it
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
