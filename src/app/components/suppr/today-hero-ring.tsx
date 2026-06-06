"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, Sparkles } from "lucide-react";
import { DailyRing, type CalorieRingDisplayMode } from "./daily-ring";
import { MACRO_RING_TOGGLE, todayStatusChip } from "../../../lib/copy/today";
import { SupprCard } from "../ui/suppr-card.tsx";

/**
 * TodayHeroRing — Today-screen calorie ring wrapper.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). This is
 * a pure presentation wrapper — it holds no state of its own beyond what
 * the parent passes in. Keeping it thin so any visual or behavioural
 * change still flows through the composition root.
 *
 * Mirrors the mobile `TodayHeroRing` wrapper around `CalorieRing`.
 *
 * Sloe parity (2026-06-04): status chip + Remaining/Consumed toggle row
 * above the ring, matching native `apps/mobile/components/today/TodayHeroRing.tsx`.
 */
export interface TodayHeroRingProps {
  consumed: number;
  target: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  displayMode: CalorieRingDisplayMode;
  onDisplayModeChange: (mode: CalorieRingDisplayMode) => void;
  onPressWhy?: () => void;
  pulse?: boolean;
}

type ChipState = "empty" | "under" | "over";

function HeroStatusChip({ state }: { state: ChipState }) {
  const config =
    state === "over"
      ? {
          label: todayStatusChip("over"),
          className: "bg-destructive/10 text-destructive-solid",
          Icon: CircleAlert,
        }
      : state === "empty"
        ? {
            label: todayStatusChip("empty"),
            className: "bg-[#EDEAF1] text-foreground-brand",
            Icon: Sparkles,
          }
        : {
            label: todayStatusChip("under"),
            className: "bg-success/15 text-success-solid",
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

function DisplayModeToggle({
  displayMode,
  onDisplayModeChange,
}: {
  displayMode: CalorieRingDisplayMode;
  onDisplayModeChange: (mode: CalorieRingDisplayMode) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full border border-border bg-muted/40 p-0.5 text-[10px] font-medium"
      role="group"
      aria-label="Calorie ring display"
      data-testid="today-ring-display-toggle"
    >
      {(["remaining", "consumed"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onDisplayModeChange(mode)}
          aria-pressed={displayMode === mode}
          className={`rounded-full px-3 py-1 capitalize transition-colors ${
            displayMode === mode
              ? "bg-card text-foreground-brand shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}

export function TodayHeroRing({
  consumed,
  target,
  proteinPct,
  carbsPct,
  fatPct,
  expanded,
  onToggleExpanded,
  displayMode,
  onDisplayModeChange,
  onPressWhy: _onPressWhy,
  pulse = false,
}: TodayHeroRingProps) {
  const isEmpty = consumed === 0 || target <= 0;
  const isOver = target > 0 && consumed > target;
  const chipState: ChipState = isEmpty ? "empty" : isOver ? "over" : "under";

  return (
    <SupprCard
      elevation="slab-flat"
      radius="lg"
      padding="none"
      className="flex flex-col items-center mb-3 px-4 py-3 gap-2"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <HeroStatusChip state={chipState} />
        <DisplayModeToggle
          displayMode={displayMode}
          onDisplayModeChange={onDisplayModeChange}
        />
      </div>
      <DailyRing
        consumed={consumed}
        target={target}
        size={128}
        strokeWidth={9}
        proteinPct={proteinPct}
        carbsPct={carbsPct}
        fatPct={fatPct}
        expanded={expanded}
        displayMode={displayMode}
        pulse={pulse}
      />
      <button
        type="button"
        data-testid="today-macro-rings-toggle"
        onClick={onToggleExpanded}
        className="text-[11px] font-semibold text-primary-solid hover:opacity-80 transition-opacity"
      >
        {expanded ? MACRO_RING_TOGGLE.hide : MACRO_RING_TOGGLE.show}
      </button>
    </SupprCard>
  );
}
