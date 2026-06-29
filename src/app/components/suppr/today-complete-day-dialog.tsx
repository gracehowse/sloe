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
import { SupprButton } from "./suppr-button";
import { CompleteDayV3Section } from "./CompleteDayV3Section";
import { COMPLETE_DAY_V3_COPY } from "@/lib/completeDayV3";
import { isFeatureEnabled } from "@/lib/analytics/track";
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
  todayProteinG?: number;
  proteinTargetG?: number;
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
  todayProteinG = 0,
  proteinTargetG,
  maintenanceTdeeKcal,
  profileGoal,
  profileMeasurementSystem,
  onViewProgress,
}: TodayCompleteDayDialogProps) {
  const v3 = isFeatureEnabled("eng1247_section_a_v1");
  const dayLabel = new Date().toLocaleDateString(undefined, { weekday: "long" });
  const title = v3 ? COMPLETE_DAY_V3_COPY.title : "Day logged!";
  const prediction =
    profileWeightKg != null && todayCalories > 0
      ? projectWeight({
          currentWeightKg: profileWeightKg,
          todayCalories,
          targetCalories,
          maintenanceTdeeKcal,
          goal: profileGoal,
        })
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-center max-w-sm">
        <div className="flex flex-col items-center py-4">
          <DialogHeader className={v3 ? "text-left w-full mb-2" : "sr-only"}>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Weight projection based on today&apos;s intake</DialogDescription>
          </DialogHeader>
          {!v3 ? <p className="text-lg font-bold text-foreground mb-6">{title}</p> : null}
          {!v3 ? (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
              style={{ background: "var(--primary-soft)" }}
            >
              <Icons.check className="w-10 h-10 text-primary" />
            </div>
          ) : null}

          {v3 && prediction && profileWeightKg != null ? (
            <CompleteDayV3Section
              dayLabel={dayLabel}
              eatenKcal={todayCalories}
              targetKcal={targetCalories}
              proteinG={todayProteinG}
              proteinTargetG={proteinTargetG}
              currentWeightKg={profileWeightKg}
              projectedWeightKg={prediction.projectedWeightKg}
              projectionWeeks={prediction.projectionWeeks}
              measurementSystem={profileMeasurementSystem}
            />
          ) : null}

          {!v3 && profileWeightKg != null && todayCalories > 0 && prediction ? (() => {
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
          })() : null}

          {!v3 && (profileWeightKg == null || todayCalories <= 0) ? (
            <p className="text-sm text-muted-foreground mb-6 px-4">
              Great work logging today! Set your weight in your profile to see weight projections here.
            </p>
          ) : null}

          {v3 && (profileWeightKg == null || todayCalories <= 0) ? (
            <p className="text-sm text-muted-foreground mb-6 px-4 text-left w-full">
              Great work logging today! Set your weight in your profile to see weight projections here.
            </p>
          ) : null}

          <SupprButton
            variant="primary"
            onClick={onViewProgress}
            className="w-full py-3.5 mt-4"
          >
            View my progress
          </SupprButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
