"use client";

import * as React from "react";

import { SupprCard } from "../ui/suppr-card";
import { computePlanDayDetail } from "@/lib/planning/planWeekStatus";

/**
 * PlanDayDetailBandV3 — Sloe v3 Plan day-detail calorie band.
 *
 * WEB parity twin of `apps/mobile/components/plan/PlanDayDetailBandV3.tsx`
 * (prototype `plan-day` ~L4771-4783): the selected day's name + kcal/target, a
 * 7px progress bar (sage under / amber over), the gap subline, and an optional
 * macro mini-stat row. Verdict + bar logic come from the shared
 * `computePlanDayDetail` so web parity can't drift. Behind sloe_v3_plan.
 *
 * Soft-lifted card (mobile `lift="soft"` → web `elevation="card"`) — the day
 * band sits on page ground, so it takes the one-card soft treatment.
 */
export interface PlanDayDetailBandV3Props {
  /** e.g. "Thursday 19". */
  dayLabel: string;
  dayTotalKcal: number;
  targetKcal: number;
  /** Filled (non-empty) slot count — 0 → "Nothing planned yet". */
  plannedCount: number;
  cookedCount: number;
  /** Day macro totals (grams), or null to hide the mini-stat row. */
  macros: { protein: number; carbs: number; fat: number } | null;
}

export function PlanDayDetailBandV3({
  dayLabel,
  dayTotalKcal,
  targetKcal,
  plannedCount,
  cookedCount,
  macros,
}: PlanDayDetailBandV3Props) {
  const { subline, barPct, tone } = computePlanDayDetail(
    dayTotalKcal,
    targetKcal,
    plannedCount,
    cookedCount,
  );
  const barColor =
    tone === "warning" ? "var(--warning)" : "var(--accent-success)";
  return (
    <SupprCard
      data-testid="plan-day-detail-band"
      elevation="card"
      radius="lg"
      padding="lg"
      className="mt-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-[family-name:var(--font-headline)] text-[18px] leading-[22px] text-foreground">
          {dayLabel}
        </p>
        <p className="text-[13px] tabular-nums text-foreground-tertiary">
          <span className="font-bold text-foreground">
            {dayTotalKcal.toLocaleString()}
          </span>{" "}
          / {targetKcal.toLocaleString()}
        </p>
      </div>
      <div
        className="mb-2.5 mt-[11px] h-[7px] overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--background-secondary)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.round(barPct * 100)}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <p className="text-[13px] text-foreground-secondary">{subline}</p>
        {macros ? (
          <p className="text-[13px] tabular-nums text-foreground-tertiary">
            P {Math.round(macros.protein)}g&nbsp;&nbsp;C{" "}
            {Math.round(macros.carbs)}g&nbsp;&nbsp;F {Math.round(macros.fat)}g
          </p>
        ) : null}
      </div>
    </SupprCard>
  );
}

export default PlanDayDetailBandV3;
