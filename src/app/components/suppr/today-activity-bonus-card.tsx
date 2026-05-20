"use client";

import * as React from "react";
import { Icons } from "../ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  buildTdeeExplainerCopy,
  calculateBMR,
  kgToLb,
  type ActivityLevel,
  type Sex,
} from "../../../lib/nutrition/tdee";
import { weekSummaryHeading } from "../../../lib/nutrition/weekSummaryWindow";
import type { WeekSummaryMode } from "../../../lib/nutrition/weekSummaryWindow";
import {
  buildMaintenancePopoverCopy,
  type MaintenanceConfidence,
  type MaintenanceSource,
} from "../../../lib/nutrition/resolveMaintenance";
import { weekDeficitToKg } from "../../../lib/nutrition/maintenanceChain";
import {
  ACTIVITY_BUDGET_DISCOVER_BODY,
  ACTIVITY_BUDGET_DISCOVER_CTA,
  ACTIVITY_BUDGET_DISCOVER_TITLE,
} from "../../../lib/nutrition/activityBudgetDiscoverability";
import { todayKey } from "../../../lib/nutrition/trackerDate";

/**
 * TodayActivityBonusCard — summary + per-workout + weekly deficit.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). All
 * data is passed in by the host; this is pure rendering plus the
 * weekly rollup which reads the same shape as before.
 */
export interface TodayWorkout {
  type: string;
  minutes: number;
  calories: number;
  source: string;
}

export interface TodayActivityBonusCardProps {
  hasBurnData: boolean;
  totalBurnKcal: number;
  effectiveCalorieTarget: number;
  consumedCalories: number;
  basalBurnKcal: number;
  activityBurnForSelectedDay: number;
  workouts: TodayWorkout[];
  weekSummaryMode: WeekSummaryMode;
  weekSummaryKeys: string[];
  activityBurnByDay: Record<string, number>;
  basalBurnByDay: Record<string, number>;
  nutritionByDay: Record<string, Array<{ calories?: number }>>;
  selectedDateKey: string;
  profileMeasurementSystem: "metric" | "imperial";
  /**
   * Effective maintenance TDEE for the user (adaptive when confident,
   * else static Mifflin). When non-null/positive, the card renders a
   * 4th "Maintenance" tile alongside Total burn / Target / Under-Over.
   * Pass `null` (not zero) to omit the tile — zero is misleading.
   *
   * Wired 2026-04-18 from `NutritionTracker.tsx:profileMaintenanceTdee`
   * to close TestFlight feedback `AAtW7dYcCBPyBdsMU6UqiQQ`/
   * `AFdtq8z_FmWRCispqF04Lsk`.
   */
  maintenanceTdeeKcal: number | null;
  /** For the info-popover BMR line. Optional — popover hides BMR row when missing. */
  profileSex?: Sex | null;
  profileWeightKg?: number | null;
  profileHeightCm?: number | null;
  profileAge?: number | null;
  profileActivityLevel?: ActivityLevel | null;
  /**
   * F-3 (2026-04-19) — when present, the popover uses the canonical
   * shared copy and picks the adaptive / formula sentence from
   * `maintenanceSource`. When omitted, falls back to the richer BMR ×
   * multiplier breakdown so hosts that haven't wired
   * `resolveMaintenance` yet don't regress.
   */
  maintenanceSource?: MaintenanceSource | null;
  maintenanceConfidence?: MaintenanceConfidence;
  /** F-161 — bonus kcal that would apply when preference is on. */
  activityBudgetAddonKcal?: number;
  preferActivityAdjustedCalories?: boolean;
  showActivityBudgetDiscoverBanner?: boolean;
  onEnableActivityBudget?: () => void;
  onDismissActivityBudgetDiscover?: () => void;
}

export function TodayActivityBonusCard({
  hasBurnData,
  totalBurnKcal,
  effectiveCalorieTarget,
  consumedCalories,
  basalBurnKcal,
  activityBurnForSelectedDay,
  workouts,
  weekSummaryMode,
  weekSummaryKeys,
  activityBurnByDay,
  basalBurnByDay,
  nutritionByDay,
  selectedDateKey,
  profileMeasurementSystem,
  maintenanceTdeeKcal,
  profileSex,
  profileWeightKg,
  profileHeightCm,
  profileAge,
  profileActivityLevel,
  maintenanceSource,
  maintenanceConfidence,
  activityBudgetAddonKcal = 0,
  preferActivityAdjustedCalories = true,
  showActivityBudgetDiscoverBanner = false,
  onEnableActivityBudget,
  onDismissActivityBudgetDiscover,
}: TodayActivityBonusCardProps) {
  if (!hasBurnData) return null;

  const showDiscover =
    showActivityBudgetDiscoverBanner &&
    !preferActivityAdjustedCalories &&
    activityBudgetAddonKcal > 0 &&
    selectedDateKey === todayKey();

  const deficit = totalBurnKcal - consumedCalories;
  const isDeficit = deficit >= 0;

  let weekBurn = 0;
  let weekConsumed = 0;
  for (const dk of weekSummaryKeys) {
    const activeKcal =
      activityBurnByDay[dk] ?? (dk === selectedDateKey ? activityBurnForSelectedDay : 0);
    weekBurn += activeKcal + (basalBurnByDay[dk] ?? 0);
    const dayMeals = nutritionByDay[dk] ?? [];
    weekConsumed += dayMeals.reduce((s, m) => s + Math.max(0, m.calories ?? 0), 0);
  }
  const showWeekly = weekBurn > 0;
  const weekDeficit = weekBurn - weekConsumed;
  const dailyAvgDeficit = Math.round(weekDeficit / 7);
  // 2026-05-05 — single 7700 kcal/kg path; mirrors onboarding pace
  // promises + whyThisNumber explainer. Was 3500/lb * 0.4536/kg.
  const weeklyKgRate = weekDeficitToKg(weekDeficit);
  const weeklyMassLabel =
    profileMeasurementSystem === "imperial"
      ? `${(Math.round(kgToLb(weeklyKgRate) * 10) / 10).toFixed(1)} lb`
      : `${weeklyKgRate.toFixed(2)} kg`;
  const isWeekDeficit = weekDeficit >= 0;

  // 4th "Maintenance" tile — render only when we actually know the
  // user's maintenance TDEE. Zero or null = omit the tile rather than
  // print a misleading "0 kcal · Maintenance" cell. (TestFlight
  // `AAtW7dYcCBPyBdsMU6UqiQQ`/`AFdtq8z_FmWRCispqF04Lsk`, 2026-04-18.)
  const hasMaintenanceTile = maintenanceTdeeKcal != null && maintenanceTdeeKcal > 0;

  // Info-popover copy uses the canonical helper so wording stays in
  // lockstep with mobile and the parity test in
  // `tests/unit/tdeeExplainer.test.ts`.
  const popoverBmr =
    profileSex && profileWeightKg && profileHeightCm && profileAge
      ? Math.round(calculateBMR(profileSex, profileWeightKg, profileHeightCm, profileAge))
      : null;
  const popoverActivity: ActivityLevel = profileActivityLevel ?? "sedentary";
  // F-3 (2026-04-19): prefer the canonical shared copy when the host
  // supplies a resolved source. Keeps this popover byte-identical to
  // mobile's.
  const popoverCopy =
    hasMaintenanceTile && popoverBmr != null
      ? maintenanceSource
        ? buildMaintenancePopoverCopy({
            kcal: maintenanceTdeeKcal!,
            source: maintenanceSource,
            confidence: maintenanceConfidence ?? null,
            formulaKcal: null,
            adaptiveRejectedAsStale: false,
          })
        : buildTdeeExplainerCopy({
            maintenanceTdeeKcal: maintenanceTdeeKcal!,
            bmrKcal: popoverBmr,
            activityLevel: popoverActivity,
            basalKcal: basalBurnKcal,
            activeKcal: activityBurnForSelectedDay,
          })
      : null;

  return (
    <div className="rounded-card border border-border bg-card p-4 mt-4">
      {showDiscover ? (
        <div className="mb-3 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[12px] font-semibold text-foreground">{ACTIVITY_BUDGET_DISCOVER_TITLE}</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{ACTIVITY_BUDGET_DISCOVER_BODY}</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={onEnableActivityBudget}
              className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
            >
              {ACTIVITY_BUDGET_DISCOVER_CTA}
            </button>
            <button
              type="button"
              onClick={onDismissActivityBudgetDiscover}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-2 mb-3">
        <Icons.calories className="h-5 w-5 text-warning" />
        <h3 className="text-sm font-bold text-foreground flex-1">Activity Bonus</h3>
        {popoverCopy ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="What is maintenance TDEE?"
                data-testid="today-activity-bonus-info-trigger"
                className="rounded-full p-1 -m-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <Icons.info className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              data-testid="today-activity-bonus-info-content"
              className="text-xs leading-relaxed w-80"
            >
              {popoverCopy}
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      {/* Summary row — 3 tiles by default, +Maintenance when known */}
      <div
        className={`grid ${hasMaintenanceTile ? "grid-cols-4" : "grid-cols-3"} gap-2 text-center mb-3`}
        data-testid="today-activity-bonus-summary-row"
      >
        <div>
          <p className="text-lg font-extrabold text-foreground tabular-nums">{totalBurnKcal.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Total burn</p>
        </div>
        <div className="border-l border-border">
          <p className="text-lg font-extrabold text-foreground tabular-nums">{effectiveCalorieTarget > 0 ? effectiveCalorieTarget.toLocaleString() : "—"}</p>
          <p className="text-[10px] text-muted-foreground">Target intake</p>
        </div>
        {hasMaintenanceTile ? (
          <div className="border-l border-border" data-testid="today-activity-bonus-maintenance-tile">
            <p className="text-lg font-extrabold text-foreground tabular-nums">{maintenanceTdeeKcal!.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Maintenance</p>
          </div>
        ) : null}
        <div className="border-l border-border">
          <p className={`text-lg font-extrabold tabular-nums ${isDeficit ? "text-success" : "text-destructive"}`}>{Math.abs(deficit).toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">{isDeficit ? "Under" : "Over"}</p>
        </div>
      </div>

      {/* Burn breakdown */}
      <div className="space-y-1 mb-3 text-xs">
        {basalBurnKcal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Resting energy</span>
            <span className="font-semibold text-foreground tabular-nums">{basalBurnKcal.toLocaleString()} kcal</span>
          </div>
        )}
        {activityBurnForSelectedDay > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Active energy</span>
            <span className="font-semibold text-foreground tabular-nums">{activityBurnForSelectedDay.toLocaleString()} kcal</span>
          </div>
        )}
      </div>

      {/* Workouts */}
      {workouts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Workouts</p>
          {workouts.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-0.5">
              <Icons.dumbbell className="h-4 w-4 text-primary" />
              <span className="flex-1 text-foreground">{w.type}</span>
              {w.minutes > 0 && <span className="text-muted-foreground tabular-nums">{w.minutes} min</span>}
              {w.calories > 0 && <span className="font-semibold text-warning tabular-nums">{w.calories} kcal</span>}
            </div>
          ))}
        </div>
      )}

      {/* Weekly deficit summary.
          Audit T13 (2026-05-05) — neutral muted text when
          `weekConsumed === 0` so a user with burn data but no logged
          food across the window doesn't see green "Avg daily deficit:
          2,400 kcal" affirming a degenerate state (false success).
          Mirrors the today-tile rule shipped 2026-04-25 + the mobile
          `TodayActivityBonusCard` change in the same PR. */}
      {showWeekly && (
        (() => {
          const isCalibrating = weekConsumed === 0;
          const valueClasses = isCalibrating
            ? "text-muted-foreground"
            : isWeekDeficit
              ? "text-success"
              : "text-destructive";
          return (
            <div className="mt-3 pt-3 border-t border-border space-y-1 text-xs">
              <p className="font-semibold text-foreground mb-1.5">{weekSummaryHeading(weekSummaryMode)}</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg daily {isWeekDeficit ? "deficit" : "surplus"}</span>
                <span className={`font-semibold tabular-nums ${valueClasses}`}>{Math.abs(dailyAvgDeficit).toLocaleString()} kcal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Weekly {isWeekDeficit ? "deficit" : "surplus"}</span>
                <span className={`font-semibold tabular-nums ${valueClasses}`}>{Math.abs(weekDeficit).toLocaleString()} kcal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Projected weekly {isWeekDeficit ? "loss" : "gain"}</span>
                <span className={`font-semibold tabular-nums ${valueClasses}`}>{weeklyMassLabel}</span>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}
