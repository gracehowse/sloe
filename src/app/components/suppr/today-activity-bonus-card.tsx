"use client";

import * as React from "react";
import { Flame, Target, TrendingUp, Utensils } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { SupprButton } from "./suppr-button";
import { Icons } from "../ui/icons";
import {
  buildTdeeExplainerCopy,
  calculateBMR,
  kgToLb,
  type ActivityLevel,
  type Sex,
} from "../../../lib/nutrition/tdee";
import { WEEKLY_ROLLING_DENOMINATOR_HINT } from "../../../lib/copy/today";
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
import {
  NET_ENERGY_CHIP_BG,
  NET_ENERGY_CHIP_LABEL,
  NET_ENERGY_STATE_COLOR,
  netEnergyChipState,
  netEnergyKcalUnit,
  netEnergyMarkerFraction,
  netEnergySubline,
} from "../../../lib/nutrition/netEnergyBalance";

/**
 * TodayActivityBonusCard — Figma TD1 Energy balance + 7-day rolling.
 *
 * Sloe re-skin (2026-06-04): separate flat slabs with net headline hero,
 * Burned/Eaten/Maintenance stat row, and sibling weekly rollup card.
 * Parity: `apps/mobile/components/today/TodayActivityBonusCard.tsx`.
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
  maintenanceTdeeKcal: number | null;
  profileSex?: Sex | null;
  profileWeightKg?: number | null;
  profileHeightCm?: number | null;
  profileAge?: number | null;
  profileActivityLevel?: ActivityLevel | null;
  maintenanceSource?: MaintenanceSource | null;
  maintenanceConfidence?: MaintenanceConfidence;
  activityBudgetAddonKcal?: number;
  preferActivityAdjustedCalories?: boolean;
  showActivityBudgetDiscoverBanner?: boolean;
  onEnableActivityBudget?: () => void;
  onDismissActivityBudgetDiscover?: () => void;
}

const LABEL_CLASS =
  "text-[10px] font-medium uppercase tracking-wide text-muted-foreground";

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

  const isToday = selectedDateKey === todayKey();
  const showDiscover =
    showActivityBudgetDiscoverBanner &&
    !preferActivityAdjustedCalories &&
    activityBudgetAddonKcal > 0 &&
    isToday;

  const hasMaintenanceTile = maintenanceTdeeKcal != null && maintenanceTdeeKcal > 0;

  const popoverBmr =
    profileSex && profileWeightKg && profileHeightCm && profileAge
      ? Math.round(calculateBMR(profileSex, profileWeightKg, profileHeightCm, profileAge))
      : null;
  const popoverActivity: ActivityLevel = profileActivityLevel ?? "sedentary";
  const popoverCopy =
    hasMaintenanceTile && popoverBmr != null
      ? maintenanceSource
        ? buildMaintenancePopoverCopy({
            kcal: maintenanceTdeeKcal!,
            source: maintenanceSource,
            confidence: maintenanceConfidence ?? null,
            formulaKcal: null,
            adaptiveRejectedAsStale: false,
            adaptiveRejectedBelowFormula: false,
            rejectedAdaptiveKcal: null,
          })
        : buildTdeeExplainerCopy({
            maintenanceTdeeKcal: maintenanceTdeeKcal!,
            bmrKcal: popoverBmr,
            activityLevel: popoverActivity,
            basalKcal: basalBurnKcal,
            activeKcal: activityBurnForSelectedDay,
          })
      : null;

  const net = totalBurnKcal - consumedCalories;
  const isDeficit = net >= 0;
  const chipState = netEnergyChipState(net);
  const chipColor = NET_ENERGY_STATE_COLOR[chipState];
  // AA-safe -solid background for the small white-on-fill state chip (white on
  // clay #C8794E is 3.33:1). Headline + marker keep the vivid `chipColor`.
  const chipBg = NET_ENERGY_CHIP_BG[chipState];
  const balanceFraction = netEnergyMarkerFraction(
    net,
    hasMaintenanceTile ? maintenanceTdeeKcal : null,
    consumedCalories,
    isDeficit,
  );
  const netSubLine = netEnergySubline({
    burnedKcal: totalBurnKcal,
    eatenKcal: consumedCalories,
    isToday,
    netKcal: net,
    isDeficit,
  });

  let weekBurn = 0;
  let weekConsumed = 0;
  let loggedBurn = 0;
  let loggedConsumed = 0;
  let loggedDays = 0;
  for (const dk of weekSummaryKeys) {
    const activeKcal =
      activityBurnByDay[dk] ?? (dk === selectedDateKey ? activityBurnForSelectedDay : 0);
    const dayBurn = activeKcal + (basalBurnByDay[dk] ?? 0);
    const dayMeals = nutritionByDay[dk] ?? [];
    const dayConsumed = dayMeals.reduce((s, m) => s + Math.max(0, m.calories ?? 0), 0);
    weekBurn += dayBurn;
    weekConsumed += dayConsumed;
    if (dayMeals.length > 0) {
      loggedBurn += dayBurn;
      loggedConsumed += dayConsumed;
      loggedDays += 1;
    }
  }
  const showWeekly = weekBurn > 0;
  const weekDeficit = weekBurn - weekConsumed;
  const dailyAvgDeficit =
    loggedDays > 0 ? Math.round((loggedBurn - loggedConsumed) / loggedDays) : 0;
  const weeklyKgRate = weekDeficitToKg(weekDeficit);
  const weeklyMassLabel =
    profileMeasurementSystem === "imperial"
      ? `${(Math.round(kgToLb(weeklyKgRate) * 10) / 10).toFixed(1)} lb`
      : `${weeklyKgRate.toFixed(2)} kg`;
  const isWeekDeficit = weekDeficit >= 0;

  return (
    <div className="flex flex-col gap-5">
      <div
        // One-treatment elevation (Grace 2026-06-09): page-ground card → soft
        // lift (`card-slab`). Was flat slab.
        className="rounded-card bg-card card-slab p-5"
        data-testid="today-energy-balance-card"
      >
        {showDiscover ? (
          <div className="mb-3 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-semibold text-foreground">{ACTIVITY_BUDGET_DISCOVER_TITLE}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{ACTIVITY_BUDGET_DISCOVER_BODY}</p>
            <div className="mt-2 flex items-center gap-3">
              {/* Button system (2026-06-12): this discover nudge is a SECONDARY
                  action on Today (Complete Day / "what to eat next" own primary),
                  so both its CTAs are GHOST `SupprButton`s (transparent, plum
                  label, no border). Mirror of mobile `TodayActivityBonusCard`
                  (both ghost). Supersedes the old aubergine-OUTLINE treatment. */}
              <SupprButton
                variant="ghost"
                onClick={onEnableActivityBudget}
                className="h-auto px-3 py-1.5 text-[11px]"
              >
                {ACTIVITY_BUDGET_DISCOVER_CTA}
              </SupprButton>
              <SupprButton
                variant="ghost"
                onClick={onDismissActivityBudgetDiscover}
                className="h-auto px-3 py-1.5 text-[11px]"
              >
                Not now
              </SupprButton>
            </div>
          </div>
        ) : null}

        <div className="mb-3 flex items-center justify-between gap-2">
          <span className={LABEL_CLASS}>Net energy</span>
          <div className="flex items-center gap-2">
            {popoverCopy ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="What is maintenance TDEE?"
                    data-testid="today-activity-bonus-info-trigger"
                    className="-m-1 rounded-full p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <Icons.info className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  data-testid="today-activity-bonus-info-content"
                  className="w-80 text-xs leading-relaxed"
                >
                  {popoverCopy}
                </PopoverContent>
              </Popover>
            ) : null}
            <span
              data-testid="today-activity-bonus-net-chip"
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white"
              style={{ backgroundColor: chipBg }}
            >
              {NET_ENERGY_CHIP_LABEL[chipState]}
            </span>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-baseline gap-2">
            <span
              data-testid="today-activity-bonus-net-headline"
              className="font-[family-name:var(--font-headline)] text-[52px] font-medium leading-none tabular-nums"
              style={{ color: chipColor }}
            >
              {Math.abs(net).toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">{netEnergyKcalUnit(chipState)}</span>
          </div>
          <p className="mt-2 mb-4 text-[13px] text-muted-foreground">{netSubLine}</p>

          {(hasBurnData || consumedCalories > 0) ? (
            <>
              <div
                className="relative mb-2 h-5"
                role="progressbar"
                aria-label="Energy balance"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(balanceFraction * 100)}
              >
                <div
                  className="h-2.5 w-full rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, var(--success) 0%, var(--border) 50%, var(--primary) 100%)",
                  }}
                />
                <div
                  className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-[3px] bg-background"
                  style={{
                    left: `${balanceFraction * 100}%`,
                    marginLeft: -10,
                    borderColor: chipColor,
                  }}
                />
              </div>
              <div className="mb-4 flex justify-between">
                <span className={LABEL_CLASS}>Deficit</span>
                <span className={LABEL_CLASS}>Maintenance</span>
                <span className={LABEL_CLASS}>Surplus</span>
              </div>
            </>
          ) : null}
        </div>

        <div
          data-testid="today-activity-bonus-summary-row"
          className="mb-3 flex items-stretch border-t border-border pt-4 text-center"
        >
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-center gap-1.5">
              <Flame className="h-4 w-4 text-[var(--activity)]" aria-hidden />
              <span className={LABEL_CLASS}>Burned</span>
            </div>
            <p className="font-[family-name:var(--font-headline)] text-lg font-medium tabular-nums text-foreground">
              {totalBurnKcal.toLocaleString()}
            </p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-center gap-1.5">
              <Utensils className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className={LABEL_CLASS}>Eaten</span>
            </div>
            <p className="font-[family-name:var(--font-headline)] text-lg font-medium tabular-nums text-foreground">
              {consumedCalories.toLocaleString()}
            </p>
          </div>
          {hasMaintenanceTile ? (
            <>
              <div className="w-px bg-border" />
              <div className="flex-1" data-testid="today-activity-bonus-maintenance-tile">
                <div className="mb-1.5 flex items-center justify-center gap-1.5">
                  <Target className="h-4 w-4 text-primary" aria-hidden />
                  <span className={LABEL_CLASS}>Maintenance</span>
                </div>
                <p className="font-[family-name:var(--font-headline)] text-lg font-medium tabular-nums text-foreground">
                  {maintenanceTdeeKcal!.toLocaleString()}
                </p>
              </div>
            </>
          ) : null}
        </div>

        {effectiveCalorieTarget > 0 ? (
          <p className="mb-3 text-center text-[11px] text-muted-foreground">
            Calorie goal {isToday ? "today" : "for this day"} ·{" "}
            <span className="font-semibold text-foreground">
              {effectiveCalorieTarget.toLocaleString()} kcal
            </span>
          </p>
        ) : null}

        {(basalBurnKcal > 0 || activityBurnForSelectedDay > 0) ? (
          <div className="mb-3 space-y-1 text-xs">
            {basalBurnKcal > 0 ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Resting energy</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {basalBurnKcal.toLocaleString()} kcal
                </span>
              </div>
            ) : null}
            {activityBurnForSelectedDay > 0 ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active energy</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {activityBurnForSelectedDay.toLocaleString()} kcal
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {workouts.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground">Workouts</p>
            {workouts.map((w, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5 text-xs">
                <Icons.dumbbell className="h-4 w-4 text-primary" />
                <span className="flex-1 text-foreground">{w.type}</span>
                {w.minutes > 0 ? (
                  <span className="tabular-nums text-muted-foreground">{w.minutes} min</span>
                ) : null}
                {w.calories > 0 ? (
                  <span className="font-semibold tabular-nums text-[var(--activity-solid)]">
                    {w.calories} kcal
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {showWeekly ? (
        <div
          // One-treatment elevation (Grace 2026-06-09): page-ground card → soft
          // lift (`card-slab`). Was flat slab.
          className="rounded-card bg-card card-slab p-5"
          data-testid="today-weekly-rolling-card"
        >
          <div className="mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-[var(--success)]" aria-hidden />
            <span className={LABEL_CLASS}>{weekSummaryHeading(weekSummaryMode)}</span>
          </div>
          {(() => {
            const isCalibrating = weekConsumed === 0;
            const valueClasses = isCalibrating
              ? "text-muted-foreground"
              : isWeekDeficit
                ? "text-[var(--success)]"
                : "text-[var(--warning)]";
            return (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Avg daily {isWeekDeficit ? "deficit" : "surplus"}
                  </span>
                  <span className={`font-[family-name:var(--font-headline)] text-base font-medium tabular-nums ${valueClasses}`}>
                    {Math.abs(dailyAvgDeficit).toLocaleString()} kcal
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Weekly {isWeekDeficit ? "deficit" : "surplus"}
                  </span>
                  <span className={`font-[family-name:var(--font-headline)] text-base font-medium tabular-nums ${valueClasses}`}>
                    {Math.abs(weekDeficit).toLocaleString()} kcal
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Projected weekly {isWeekDeficit ? "loss" : "gain"}
                  </span>
                  <span className={`font-[family-name:var(--font-headline)] text-base font-medium tabular-nums ${valueClasses}`}>
                    {weeklyMassLabel}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug pt-1">
                  {WEEKLY_ROLLING_DENOMINATOR_HINT}
                </p>
              </div>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
