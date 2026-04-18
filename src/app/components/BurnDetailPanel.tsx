"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

export interface Workout {
  type: string;
  minutes: number;
  calories: number;
}

export interface BurnDetailPanelProps {
  activeBurn: number;
  restingBurn: number;
  steps: number;
  workouts: Workout[];
  maintenanceKcal: number;
  bonusCalories: number;
  open: boolean;
  onClose: () => void;
}

/**
 * Compute the projected future resting burn for the remainder of the day.
 *
 * Uses the hourly resting rate derived from resting energy already recorded
 * so far and extrapolates over the hours remaining until midnight.
 */
export function computeProjectedBurn(restingBurn: number): {
  futureBurn: number;
  hoursLeft: number;
  hourlyResting: number;
} {
  const now = new Date();
  const hoursElapsed = now.getHours() + now.getMinutes() / 60;
  const hoursLeft = Math.max(0, 24 - hoursElapsed);
  const hourlyResting = hoursElapsed > 0 && restingBurn > 0 ? restingBurn / hoursElapsed : 0;
  const futureBurn = Math.round(hourlyResting * hoursLeft);
  return { futureBurn, hoursLeft, hourlyResting };
}

/**
 * BurnDetailPanel -- surplus-only calorie burn breakdown dialog.
 *
 * Shows active energy, resting energy, projected future burn, projected total,
 * target (maintenance TDEE), and the computed bonus calories. Matches the
 * layout of apps/mobile/app/burn-detail.tsx.
 */
export function BurnDetailPanel({
  activeBurn,
  restingBurn,
  steps,
  workouts,
  maintenanceKcal,
  bonusCalories,
  open,
  onClose,
}: BurnDetailPanelProps) {
  const projected = useMemo(() => {
    const { futureBurn } = computeProjectedBurn(restingBurn);
    const projectedTotal = restingBurn + activeBurn + futureBurn;
    return { futureBurn, projectedTotal };
  }, [activeBurn, restingBurn]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Activity Bonus</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            A breakdown of your energy expenditure for today.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Active Energy Burned */}
          <section className="space-y-1.5">
            <div className="flex items-start justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wide text-foreground">
                Active Energy Burned
              </span>
              <span className="text-lg font-bold tabular-nums text-foreground">
                {activeBurn.toLocaleString()}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Energy burned over and above your resting energy. Includes exercise, walking, and other intentional movement.
            </p>
            {workouts.length > 0 && (
              <ul className="mt-2 space-y-1 pl-4">
                {workouts.map((w, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    {w.type}
                    {w.minutes > 0 ? ` \u2014 ${w.minutes} min` : ""}
                    {w.calories > 0 ? ` (${w.calories} kcal)` : ""}
                  </li>
                ))}
              </ul>
            )}
            {steps > 0 && (
              <p className="mt-1 pl-4 text-xs text-muted-foreground">
                {steps.toLocaleString()} steps
              </p>
            )}
          </section>

          {/* Resting Energy Burned */}
          <section className="space-y-1.5">
            <div className="flex items-start justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wide text-foreground">
                Resting Energy Burned
              </span>
              <span className="text-lg font-bold tabular-nums text-foreground">
                {restingBurn.toLocaleString()}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              An estimate of the energy your body uses each day while minimally active.
            </p>
          </section>

          {/* Future Energy Burned */}
          {projected.futureBurn > 0 && (
            <section className="space-y-1.5">
              <div className="flex items-start justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wide text-foreground">
                  Future Energy Burned
                </span>
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {projected.futureBurn.toLocaleString()}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                The calories we estimate you will burn throughout the rest of the day based on your current resting rate.
              </p>
            </section>
          )}

          {/* Divider */}
          <hr className="border-border" />

          {/* Projected Energy Burn */}
          <section className="space-y-1.5">
            <div className="flex items-start justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wide text-foreground">
                Projected Energy Burn
              </span>
              <span className="text-lg font-extrabold tabular-nums text-foreground">
                {projected.projectedTotal.toLocaleString()}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              If you do not move the rest of the day, this is how many calories you will burn by the end of the day.
            </p>
          </section>

          {/* Target Energy Burn */}
          {maintenanceKcal > 0 && (
            <section className="space-y-1.5">
              <div className="flex items-start justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wide text-foreground">
                  Target Energy Burn
                </span>
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {maintenanceKcal.toLocaleString()}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                The calories you should burn in a day to maintain your current weight.
              </p>
            </section>
          )}

          {/* Bonus Calories */}
          {maintenanceKcal > 0 && (
            <div
              className={`rounded-xl border p-4 space-y-1.5 ${
                bonusCalories > 0
                  ? "border-amber-400/40 bg-amber-500/10"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm font-extrabold ${
                    bonusCalories > 0 ? "text-amber-500" : "text-muted-foreground"
                  }`}
                >
                  {bonusCalories > 0 ? "Bonus Calories Earned" : "No Bonus Yet"}
                </span>
                <span
                  className={`text-xl font-extrabold tabular-nums ${
                    bonusCalories > 0 ? "text-amber-500" : "text-muted-foreground"
                  }`}
                >
                  {bonusCalories > 0 ? `+${bonusCalories.toLocaleString()}` : "0"}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {bonusCalories > 0
                  ? `Your projected burn (${projected.projectedTotal.toLocaleString()}) exceeds your maintenance (${maintenanceKcal.toLocaleString()}). The extra ${bonusCalories.toLocaleString()} kcal are added to your calorie target.`
                  : "Your projected burn has not exceeded your maintenance yet. Keep moving to earn bonus calories."}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
