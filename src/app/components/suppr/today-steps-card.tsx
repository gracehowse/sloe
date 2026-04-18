"use client";

import * as React from "react";
import { Icons } from "../ui/icons";
import { IconBox } from "../ui/icon-box";

/**
 * TodayStepsCard — Steps & activity card on the Today screen.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). The host
 * owns the input-buffer state + the Supabase write; this component is a
 * thin presentation wrapper so existing behaviour stays identical.
 */
export interface TodayStepsCardProps {
  stepsForSelectedDay: number | null;
  dailyStepsGoal: number;
  stepsDayInput: string;
  onStepsDayInputChange: (value: string) => void;
  onSaveSteps: () => void;
}

export function TodayStepsCard({
  stepsForSelectedDay,
  dailyStepsGoal,
  stepsDayInput,
  onStepsDayInputChange,
  onSaveSteps,
}: TodayStepsCardProps) {
  return (
    <div className="rounded-card bg-card border border-border p-3 mb-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <IconBox size="sm" tone="primary">
            <Icons.activity />
          </IconBox>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-foreground">Steps & activity</span>
            <span className="text-[11px] tabular-nums text-muted-foreground truncate">
              {stepsForSelectedDay != null
                ? `${stepsForSelectedDay.toLocaleString()} / ${dailyStepsGoal.toLocaleString()} steps`
                : "No steps logged for this day"}
            </span>
          </div>
        </div>
      </div>
      {stepsForSelectedDay != null && dailyStepsGoal > 0 && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all bg-primary"
            style={{ width: `${Math.min((stepsForSelectedDay / dailyStepsGoal) * 100, 100)}%` }}
          />
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
          placeholder="Steps"
          inputMode="numeric"
          value={stepsDayInput}
          onChange={(e) => onStepsDayInputChange(e.target.value)}
        />
        <button
          type="button"
          onClick={onSaveSteps}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shrink-0"
        >
          Save
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        Daily step goal ({dailyStepsGoal.toLocaleString()}) is stored on your profile. You can also log steps from Progress.
      </p>
    </div>
  );
}
