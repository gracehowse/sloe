"use client";

import * as React from "react";
import { DailyRing } from "./daily-ring";
import { TodayHeroRing, type TodayHeroRingProps } from "./today-hero-ring";
import { MACRO_RING_TOGGLE, TODAY_STAT_LABELS } from "../../../lib/copy/today";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { SupprCard } from "../ui/suppr-card.tsx";

/**
 * TodayHeroStats — Today-screen hero block with the calorie ring + 4
 * stat figures (Logged / Target / Burned / Net).
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
 *   toggle (rings hidden by default).
 */

const HERO_RING_SIZE = 160;

export interface TodayHeroStatsProps extends TodayHeroRingProps {
  loggedKcal: number;
  targetKcal: number;
  burnedKcal: number;
  aiSourcedCount?: number;
  /** ENG-753 — true when the user has logged today and calories are
   *  within ±10% of the daily target. Drives the "On track" pill. */
  isOnTrack?: boolean;
  /** ENG-753 — adaptive-TDEE learning progress, 0-7. Omit or 0 hides
   *  the "Adaptive TDEE learning · N of 7 days" pill. */
  tdeeLearnDays?: number;
  /** ENG-798 — win-moment ring pulse. True for ~200ms after a Today
   *  landmark fires; forwarded to the calorie ring on both breakpoints.
   *  The web colour/motion analog of mobile's success haptic. */
  pulse?: boolean;
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
    proteinPct,
    carbsPct,
    fatPct,
    expanded,
    onToggleExpanded,
    displayMode,
    onDisplayModeChange,
    onPressWhy,
    pulse,
  } = props;
  return {
    consumed,
    target,
    proteinPct,
    carbsPct,
    fatPct,
    expanded,
    onToggleExpanded,
    displayMode,
    onDisplayModeChange,
    onPressWhy,
    pulse,
  };
}

function DesktopHeroStats({
  loggedKcal,
  targetKcal,
  burnedKcal,
  consumed,
  target,
  proteinPct,
  carbsPct,
  fatPct,
  expanded,
  onToggleExpanded,
  displayMode,
  onDisplayModeChange,
  isOnTrack,
  tdeeLearnDays,
  pulse,
}: TodayHeroStatsProps) {
  const net = loggedKcal - targetKcal;
  const netStr = loggedKcal === 0 ? "—" : formatNet(net);
  const showStatRow = loggedKcal > 0;

  return (
    // Design Direction 2026 (ENG-795): canonical SupprCard so the desktop hero
    // adopts soft elevation (and drops its border) under
    // `design_system_elevation`; flag OFF stays flat. `padding="none"` keeps
    // the exact `px-4 py-4` geometry; `hidden md:block` display utility and
    // the `data-testid` are preserved.
    <SupprCard
      radius="lg"
      padding="none"
      className="hidden md:block mb-3 px-4 py-4"
      data-testid="today-hero-desktop"
    >
      <div className="flex flex-col items-center gap-3">
        {showStatRow ? (
          <div
            className="inline-flex rounded-md bg-muted/50 p-0.5"
            role="group"
            aria-label="Calorie ring display"
          >
            {(["remaining", "consumed"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onDisplayModeChange(mode)}
                aria-pressed={displayMode === mode}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors ${
                  displayMode === mode
                    ? "bg-card text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        ) : null}

        <DailyRing
          consumed={consumed}
          target={target}
          size={HERO_RING_SIZE}
          strokeWidth={10}
          proteinPct={proteinPct}
          carbsPct={carbsPct}
          fatPct={fatPct}
          expanded={expanded}
          displayMode={displayMode}
          pulse={pulse}
        />

        {showStatRow ? (
          <div
            className="grid w-full max-w-lg grid-cols-4 gap-2"
            data-testid="today-hero-stat-row"
          >
            <StatCell label={TODAY_STAT_LABELS.logged} value={loggedKcal.toLocaleString()} />
            <StatCell label={TODAY_STAT_LABELS.target} value={targetKcal.toLocaleString()} />
            <StatCell
              label={TODAY_STAT_LABELS.burned}
              value={burnedKcal > 0 ? burnedKcal.toLocaleString() : "—"}
            />
            <StatCell
              label={TODAY_STAT_LABELS.net}
              value={netStr}
              valueTone={net < 0 ? "positive" : net > 0 ? "over" : "neutral"}
            />
          </div>
        ) : null}

        {/* ENG-753 — status pills below the stat grid (prototype
            screens-web.jsx:173-177). Flag-gated; only render when the
            day has been logged (showStatRow) and at least one pill is
            applicable. */}
        {isFeatureEnabled("today-status-pills") &&
        showStatRow &&
        (isOnTrack || (tdeeLearnDays != null && tdeeLearnDays > 0)) ? (
          <div className="flex gap-2" data-testid="today-status-pills">
            {isOnTrack ? (
              <span
                data-testid="today-pill-on-track"
                className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-success"
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.5 7.6a1 1 0 0 1-1.42.006l-3.5-3.5a1 1 0 1 1 1.414-1.414l2.79 2.79 6.796-6.886a1 1 0 0 1 1.414-.006Z"
                    clipRule="evenodd"
                  />
                </svg>
                On track
              </span>
            ) : null}
            {tdeeLearnDays != null && tdeeLearnDays > 0 ? (
              <span
                data-testid="today-pill-tdee-learning"
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary"
              >
                Adaptive TDEE learning · {tdeeLearnDays} of 7 days
              </span>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          data-testid="today-macro-rings-toggle"
          onClick={onToggleExpanded}
          className="text-[11px] font-semibold text-primary hover:opacity-80 transition-opacity"
        >
          {expanded ? MACRO_RING_TOGGLE.hide : MACRO_RING_TOGGLE.show}
        </button>
      </div>
    </SupprCard>
  );
}

function StatCell({
  label,
  value,
  valueTone = "neutral",
}: {
  label: string;
  value: string;
  valueTone?: "neutral" | "positive" | "over";
}) {
  const valueColor =
    valueTone === "positive"
      ? "text-success"
      : valueTone === "over"
        ? "text-[var(--over-budget-fg)]"
        : "text-foreground";
  return (
    <div className="min-w-0 text-center px-1">
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground truncate">
        {label}
      </div>
      <div
        className={`mt-1 text-[18px] font-extrabold tabular-nums tracking-tight leading-none ${valueColor}`}
      >
        {value}
      </div>
    </div>
  );
}

function formatNet(net: number): string {
  if (net === 0) return "0";
  if (net < 0) return `\u2212${Math.abs(net).toLocaleString()}`;
  return `+${net.toLocaleString()}`;
}
