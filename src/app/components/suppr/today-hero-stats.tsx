"use client";

import * as React from "react";
import { DailyRing } from "./daily-ring";
import { TodayHeroRing, type TodayHeroRingProps } from "./today-hero-ring";
import { MACRO_RING_TOGGLE, TODAY_STAT_LABELS } from "../../../lib/copy/today";

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
}: TodayHeroStatsProps) {
  const net = loggedKcal - targetKcal;
  const netStr = loggedKcal === 0 ? "—" : formatNet(net);
  const showStatRow = loggedKcal > 0;

  return (
    <div
      className="hidden md:block mb-3 rounded-card border border-border bg-card px-4 py-4"
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

        <button
          type="button"
          data-testid="today-macro-rings-toggle"
          onClick={onToggleExpanded}
          className="text-[11px] font-semibold text-primary hover:opacity-80 transition-opacity"
        >
          {expanded ? MACRO_RING_TOGGLE.hide : MACRO_RING_TOGGLE.show}
        </button>
      </div>
    </div>
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
