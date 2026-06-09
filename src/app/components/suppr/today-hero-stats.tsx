"use client";

import * as React from "react";
import { DailyRing } from "./daily-ring";
import { TodayHeroRing, type TodayHeroRingProps } from "./today-hero-ring";
import {
  MACRO_RING_TOGGLE,
  TODAY_HERO_STAT_LABELS,
  todayStatusChip,
} from "../../../lib/copy/today";
import { CircleAlert, CircleCheck, Sparkles } from "lucide-react";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { calorieRingGeometryFromSize } from "../../../lib/nutrition/calorieRingGeometry";
import { SupprCard } from "../ui/suppr-card.tsx";

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
 *   toggle (rings hidden by default).
 */

const HERO_RING_SIZE = 160;
const DESKTOP_RING_GEOMETRY = calorieRingGeometryFromSize(HERO_RING_SIZE);

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
    expanded,
    onToggleExpanded,
    displayMode,
    onToggleDisplayMode,
    onPressWhy,
    pulse,
  } = props;
  return {
    consumed,
    target,
    baseGoal,
    proteinPct,
    carbsPct,
    fatPct,
    expanded,
    onToggleExpanded,
    displayMode,
    onToggleDisplayMode,
    onPressWhy,
    pulse,
  };
}

function DesktopHeroStats({
  loggedKcal,
  targetKcal,
  burnedKcal: _burnedKcal,
  consumed,
  target,
  baseGoal,
  proteinPct,
  carbsPct,
  fatPct,
  expanded,
  onToggleExpanded,
  displayMode,
  onToggleDisplayMode,
  isOnTrack,
  // `tdeeLearnDays` is retained on the props interface for call-site stability
  // but no longer rendered on Today — the Adaptive-TDEE line was removed to
  // match Figma `654:2` (2026-06-08). The learning state lives on Progress.
  pulse,
}: TodayHeroStatsProps) {
  const showStatRow = consumed > 0 && target > 0;
  const isEmpty = consumed === 0 || target <= 0;
  const isOver = target > 0 && consumed > target;
  const bonusKcal =
    baseGoal && baseGoal < target ? Math.round(target - baseGoal) : 0;
  const chipState: "empty" | "under" | "over" = isEmpty
    ? "empty"
    : isOver
      ? "over"
      : "under";

  return (
    // Design Direction 2026 (ENG-795): canonical SupprCard so the desktop hero
    // adopts soft elevation (and drops its border) under
    // `design_system_elevation`; flag OFF stays flat. `padding="none"` keeps
    // the exact `px-4 py-4` geometry; `hidden md:block` display utility and
    // the `data-testid` are preserved.
    <SupprCard
      elevation="card"
      radius="lg"
      padding="none"
      className="hidden md:block mb-3 px-4 py-4"
      data-testid="today-hero-desktop"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full items-center justify-between gap-2">
          <HeroStatusChip state={chipState} />
          {showStatRow ? (
            <button
              type="button"
              onClick={onToggleDisplayMode}
              className="inline-flex rounded-full bg-[#EFEFEF] p-0.5 text-[10px] font-medium"
              aria-label={`Showing ${displayMode} calories. Tap to switch.`}
              data-testid="today-ring-display-toggle"
            >
              {(["remaining", "consumed"] as const).map((mode) => (
                <span
                  key={mode}
                  aria-hidden
                  className={`rounded-full px-3 py-1 capitalize transition-colors ${
                    displayMode === mode
                      ? "bg-card text-foreground-brand shadow-sm"
                      : "text-foreground-secondary"
                  }`}
                >
                  {mode}
                </span>
              ))}
            </button>
          ) : (
            <span className="w-px shrink-0" aria-hidden />
          )}
        </div>

        <DailyRing
          consumed={consumed}
          target={target}
          size={DESKTOP_RING_GEOMETRY.size}
          strokeWidth={DESKTOP_RING_GEOMETRY.strokeWidth}
          ringRadius={DESKTOP_RING_GEOMETRY.radius}
          macroRadii={DESKTOP_RING_GEOMETRY.macroRadii}
          macroStroke={DESKTOP_RING_GEOMETRY.macroStroke}
          proteinPct={proteinPct}
          carbsPct={carbsPct}
          fatPct={fatPct}
          expanded={expanded}
          onToggle={onToggleExpanded}
          displayMode={displayMode}
          onLongPressToggleDisplayMode={onToggleDisplayMode}
          pulse={pulse}
        />

        {showStatRow ? (
          <div
            className="grid w-full max-w-lg grid-cols-3 gap-2 border-t border-border pt-3"
            data-testid="today-hero-stat-row"
          >
            <StatCell
              label={TODAY_HERO_STAT_LABELS.goal}
              value={targetKcal.toLocaleString()}
            />
            <StatCell
              label={TODAY_HERO_STAT_LABELS.eaten}
              value={loggedKcal.toLocaleString()}
            />
            {isOver ? (
              <StatCell
                label={TODAY_HERO_STAT_LABELS.over}
                value={`−${Math.round(consumed - target).toLocaleString()}`}
                valueTone="over"
              />
            ) : (
              <StatCell
                label={TODAY_HERO_STAT_LABELS.bonus}
                value={bonusKcal > 0 ? `+${bonusKcal.toLocaleString()}` : "0"}
                valueTone={bonusKcal > 0 ? "positive" : "neutral"}
              />
            )}
          </div>
        ) : null}

        {/* ENG-753 — "On track" pill below the stat grid (prototype
            screens-web.jsx:173-177). Flag-gated; only render when the
            day has been logged (showStatRow) and the user is on track.

            Sloe redesign (2026-06-08): the "Adaptive TDEE learning · N of 7
            days" pill was removed — the canonical Figma `654:2` Today hero
            shows nothing between the Goal/Eaten/Bonus stats and the "Room for
            dinner" coach line. The learning state lives on Progress; surfacing
            it on Today added clutter. The underlying adaptive-TDEE logic is
            unchanged — only this presentational line is gone. The
            `tdeeLearnDays` prop is retained for call-site stability. */}
        {isFeatureEnabled("today-status-pills") && showStatRow && isOnTrack ? (
          <div className="flex gap-2" data-testid="today-status-pills">
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

function HeroStatusChip({ state }: { state: "empty" | "under" | "over" }) {
  const config =
    state === "over"
      ? {
          label: todayStatusChip("over"),
          className: "bg-destructive/10 text-destructive",
          Icon: CircleAlert,
        }
      : state === "empty"
        ? {
            label: todayStatusChip("empty"),
            className: "bg-[#EDEAF1] text-primary",
            Icon: Sparkles,
          }
        : {
            label: todayStatusChip("under"),
            className: "bg-success/15 text-success",
            Icon: CircleCheck,
          };
  const { label, className, Icon } = config;
  return (
    <span
      data-testid="today-ring-status-chip"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      <Icon size={13} strokeWidth={2} aria-hidden />
      {label}
    </span>
  );
}

