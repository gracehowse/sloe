"use client";

import * as React from "react";
import { TodayHeroRing, type TodayHeroRingProps } from "./today-hero-ring";
import { DesktopHeroStats } from "./today-hero-stats-desktop";

/**
 * TodayHeroStats — Today-screen hero block with the calorie ring +
 * Figma `654:2` stat row (Goal / Eaten / Bonus) on every breakpoint.
 *
 * Layout is **one vertical stack on every breakpoint** so Today and
 * previous days share the same geometry (no desktop-only side-by-side
 * grid that made past days feel like a different page). Canonical copy
 * from `src/lib/copy/today.ts`.
 *
 * - **Mobile-web (`< md`)** — `TodayHeroRing` (centred ring + macro
 *   toggle link; long-press on native only).
 * - **Desktop (`>= md`)** — same column: optional REMAINING/CONSUMED
 *   chip, fixed-size ring, one row of four stats, explicit macro-ring
 *   toggle (rings hidden by default). Desktop body lives in
 *   `today-hero-stats-desktop.tsx` (screen-budget extract).
 */

export interface TodayHeroStatsProps extends TodayHeroRingProps {
  loggedKcal: number;
  targetKcal: number;
  burnedKcal: number;
  aiSourcedCount?: number;
  /** ENG-753 — true when the user has logged today and calories are
   *  within ±10% of the daily target. Drives the "On track" pill. */
  isOnTrack?: boolean;
  /** ENG-753 — adaptive-TDEE learning progress, 0-7. Retained for call-site
   *  stability but no longer rendered on Today (the "Adaptive TDEE learning ·
   *  N of 7 days" line was removed 2026-06-08 to match Figma `654:2`; the
   *  learning state lives on Progress). The underlying TDEE logic is
   *  unchanged. */
  tdeeLearnDays?: number;
  /** ENG-798 — win-moment ring pulse. True for ~200ms after a Today
   *  landmark fires; forwarded to the calorie ring on both breakpoints.
   *  The web colour/motion analog of mobile's success haptic. */
  pulse?: boolean;
  /** ENG-1016 — per-commit ring pulse. True for ~160ms after an ordinary log
   *  lands; forwarded to the calorie ring on both breakpoints. The web
   *  colour/scale analog of mobile's Medium commit haptic. */
  commitPulse?: boolean;
}

export function TodayHeroStats(props: TodayHeroStatsProps) {
  return (
    <>
      <div className="md:hidden">
        <TodayHeroRing {...extractRingProps(props)} />
      </div>
      <DesktopHeroStats {...props} />
    </>
  );
}

function extractRingProps(props: TodayHeroStatsProps): TodayHeroRingProps {
  const {
    consumed,
    target,
    baseGoal,
    proteinPct,
    carbsPct,
    fatPct,
    proteinGrams,
    carbsGrams,
    fatGrams,
    expanded,
    onToggleExpanded,
    onPressWhy,
    onPressStatusChip,
    // ENG-1293 — Coach chip is a mobile-web surface (`< md` ring only);
    // desktop (`>= md`) gets the sidebar "Coach" item instead, so
    // `DesktopHeroStats` deliberately does not consume it.
    onPressCoach,
    pulse,
    commitPulse,
    logConfirmVisible,
    coachLine,
    isFreshDay,
    onLogFreshDaySlot,
  } = props;
  return {
    consumed,
    target,
    baseGoal,
    proteinPct,
    carbsPct,
    fatPct,
    proteinGrams,
    carbsGrams,
    fatGrams,
    expanded,
    onToggleExpanded,
    onPressWhy,
    onPressStatusChip,
    onPressCoach,
    pulse,
    commitPulse,
    logConfirmVisible,
    coachLine,
    isFreshDay,
    onLogFreshDaySlot,
  };
}
