"use client";

import * as React from "react";
import { Icons } from "../ui/icons";

/**
 * TodayAppleHealthCard — desktop right-rail summary of today's Apple
 * Health data. Ported from the 2026-04-20 Claude Design prototype.
 *
 * Rules:
 *  - Web is read-only: Health data originates from the iOS app's
 *    HealthKit sync (`profiles.steps_by_day` / `activity_burn_by_day`
 *    / `basal_burn_by_day` / `latest_weight_kg`). Web never writes.
 *  - When NO Health datum exists at all (steps, active energy,
 *    resting burn AND weight all null) the card renders nothing —
 *    an all-placeholder card is noise, not signal (ENG-1495). With
 *    partial data, missing rows still show a dim "—". No fabricated
 *    zeros either way.
 *  - Weight row is omitted when `weightKg` is null — we refuse to
 *    show "0.0 kg" as a faux value.
 */

export interface TodayAppleHealthCardProps {
  /** Steps counted today from Health, or null when no sync has
   *  landed for this day yet. */
  stepsForSelectedDay: number | null;
  /** Active-energy kcal today, or null when no sync. */
  activeEnergyKcal: number | null;
  /** Resting / basal burn kcal today, or null when no sync. */
  restingBurnKcal: number | null;
  /** Latest synced weight in kg, or null when the user has never
   *  logged a weight via Health or manually. */
  latestWeightKg: number | null;
  /** Render weight in lb (true) or kg (false). */
  useImperial?: boolean;
  className?: string;
}

function formatWeight(kg: number, imperial: boolean) {
  if (imperial) {
    const lb = kg * 2.20462;
    return `${lb.toFixed(1)} lb`;
  }
  return `${kg.toFixed(1)} kg`;
}

export function TodayAppleHealthCard({
  stepsForSelectedDay,
  activeEnergyKcal,
  restingBurnKcal,
  latestWeightKg,
  useImperial = false,
  className,
}: TodayAppleHealthCardProps) {
  const hasAnyData =
    stepsForSelectedDay != null ||
    activeEnergyKcal != null ||
    restingBurnKcal != null ||
    latestWeightKg != null;

  // ENG-1495 — no real datum → no card. Web can't connect Health
  // itself, so a wall of "—" placeholders taught nothing.
  if (!hasAnyData) return null;

  const rows: Array<{ label: string; value: string; dimmed: boolean }> = [
    {
      label: "Steps",
      value:
        stepsForSelectedDay != null
          ? stepsForSelectedDay.toLocaleString()
          : "—",
      dimmed: stepsForSelectedDay == null,
    },
    {
      label: "Active energy",
      value:
        activeEnergyKcal != null
          ? `${activeEnergyKcal.toLocaleString()} kcal`
          : "—",
      dimmed: activeEnergyKcal == null,
    },
    {
      label: "Resting burn",
      value:
        restingBurnKcal != null
          ? `${restingBurnKcal.toLocaleString()} kcal`
          : "—",
      dimmed: restingBurnKcal == null,
    },
  ];
  if (latestWeightKg != null) {
    rows.push({
      label: "Weight",
      value: formatWeight(latestWeightKg, useImperial),
      dimmed: false,
    });
  }

  return (
    <section
      aria-label="Apple Health today"
      // One-treatment elevation (Grace 2026-06-09): page-ground card → soft
      // lift (`card-slab`). Was flat slab.
      className={`rounded-card bg-card card-slab p-4 ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icons.activity className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Apple Health · Today
        </h2>
      </div>

      <ul className="divide-y divide-border/60">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
          >
            <span className="text-sm text-foreground">{row.label}</span>
            <span
              className={`text-sm font-semibold tabular-nums ${
                row.dimmed ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
