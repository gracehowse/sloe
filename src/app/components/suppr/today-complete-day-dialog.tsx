"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Icons } from "../ui/icons";
import { projectWeight } from "../../../lib/weightProjection";
import { kgToLb } from "../../../lib/nutrition/tdee";

/**
 * TodayCompleteDayDialog — "Day logged!" confirmation + projection.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). The
 * projection calculation stays identical to the pre-refactor source.
 */
export interface TodayCompleteDayDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  profileWeightKg: number | null;
  todayCalories: number;
  targetCalories: number;
  /**
   * Effective maintenance TDEE (adaptive when confidence is medium/high,
   * else static Mifflin). Optional for backwards compatibility, but callers
   * should always supply it — without it the projection falls back to a
   * crude target-based heuristic that mis-classifies real deficits as gains
   * when actual burn is high. See TestFlight `ALkK-XrcMz_V-D6NrjuVYbo`.
   */
  maintenanceTdeeKcal?: number | null;
  profileGoal: string | null;
  profileMeasurementSystem: "metric" | "imperial";
  onViewProgress: () => void;
}

export function TodayCompleteDayDialog({
  open,
  onOpenChange,
  profileWeightKg,
  todayCalories,
  targetCalories,
  maintenanceTdeeKcal,
  profileGoal,
  profileMeasurementSystem,
  onViewProgress,
}: TodayCompleteDayDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-center max-w-sm">
        <div className="flex flex-col items-center py-4">
          <DialogHeader className="sr-only">
            <DialogTitle>Day logged!</DialogTitle>
            <DialogDescription>Weight projection based on today&apos;s intake</DialogDescription>
          </DialogHeader>
          <p className="text-lg font-bold text-foreground mb-6">Day logged!</p>
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
            style={{ background: "var(--primary-soft)" }}
          >
            <Icons.check className="w-10 h-10 text-primary" />
          </div>
          {profileWeightKg != null && todayCalories > 0 ? (() => {
            const prediction = projectWeight({
              currentWeightKg: profileWeightKg,
              todayCalories,
              targetCalories,
              maintenanceTdeeKcal,
              goal: profileGoal,
            });
            const projectedLabel =
              profileMeasurementSystem === "imperial"
                ? `${Math.round(kgToLb(prediction.projectedWeightKg) * 10) / 10} lb`
                : `${prediction.projectedWeightKg} kg`;
            return (
              <>
                <p className="text-lg font-bold text-foreground leading-relaxed mb-2 px-4">
                  {"At today's pace, your projected weight in "}
                  {prediction.projectionWeeks} weeks is{" "}
                  <span className="text-primary">{projectedLabel}</span>.
                </p>
                <p className="text-xs text-muted-foreground mb-6 px-4">
                  This is a rough estimate based on net calories for this day. Actual results may vary.
                </p>
              </>
            );
          })() : (
            <p className="text-sm text-muted-foreground mb-6 px-4">
              Great work logging today! Set your weight in your profile to see weight projections here.
            </p>
          )}
          {/* Sloe treatment system (2026-06-08): primary inline CTA →
              aubergine outline (transparent fill + 1.5px primary-solid
              border + primary-solid label), not a filled slab. Mirror
              of mobile `TodayCompleteDayModal`. */}
          <button
            onClick={onViewProgress}
            className="w-full py-3.5 rounded-xl border-[1.5px] border-primary-solid bg-transparent text-primary-solid font-bold text-sm hover:bg-primary/5 transition-colors"
          >
            View my progress
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
