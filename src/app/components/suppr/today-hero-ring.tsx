"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, Sparkles } from "lucide-react";
import { DailyRing, type CalorieRingDisplayMode } from "./daily-ring";
import { MACRO_RING_TOGGLE, todayStatusChip } from "../../../lib/copy/today";
import { useCalorieRingGeometry } from "../../../lib/hooks/useCalorieRingGeometry";
import { SupprCard } from "../ui/suppr-card.tsx";

/**
 * TodayHeroRing — Today-screen calorie ring wrapper (mobile-web).
 * Mirrors `apps/mobile/components/today/TodayHeroRing.tsx`.
 */
export interface TodayHeroRingProps {
  consumed: number;
  target: number;
  /** Base calorie target before activity bonus (for Bonus stat). */
  baseGoal?: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  displayMode: CalorieRingDisplayMode;
  /** Mobile parity: flips remaining/consumed AND macro-ring visibility. */
  onToggleDisplayMode: () => void;
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

function DisplayModeToggle({
  displayMode,
  onToggleDisplayMode,
}: {
  displayMode: CalorieRingDisplayMode;
  onToggleDisplayMode: () => void;
}) {
  return (
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
  );
}

function RingStatCell({
  label,
  value,
  labelClassName,
  valueClassName,
  divider,
}: {
  label: string;
  value: string;
  labelClassName?: string;
  valueClassName?: string;
  divider?: boolean;
}) {
  return (
    <div
      className={`flex-1 text-center px-2 ${divider ? "border-l border-border" : ""}`}
    >
      <div
        className={`text-[10px] font-semibold uppercase tracking-wider ${labelClassName ?? "text-foreground-tertiary"}`}
      >
        {label}
      </div>
      <div
        className={`mt-1 font-[family-name:var(--font-headline)] text-[18px] font-normal tabular-nums leading-tight ${valueClassName ?? "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

export function TodayHeroRing({
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
  onPressWhy: _onPressWhy,
  pulse = false,
}: TodayHeroRingProps) {
  const isEmpty = consumed === 0 || target <= 0;
  const isOver = target > 0 && consumed > target;
  const chipState: ChipState = isEmpty ? "empty" : isOver ? "over" : "under";
  const ringGeometry = useCalorieRingGeometry();
  const bonusKcal =
    baseGoal && baseGoal < target ? Math.round(target - baseGoal) : 0;

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
          onToggleDisplayMode={onToggleDisplayMode}
        />
      </div>
      <DailyRing
        consumed={consumed}
        target={target}
        size={ringGeometry.size}
        strokeWidth={ringGeometry.strokeWidth}
        ringRadius={ringGeometry.radius}
        macroRadii={ringGeometry.macroRadii}
        macroStroke={ringGeometry.macroStroke}
        proteinPct={proteinPct}
        carbsPct={carbsPct}
        fatPct={fatPct}
        expanded={expanded}
        onToggle={onToggleExpanded}
        displayMode={displayMode}
        onLongPressToggleDisplayMode={onToggleDisplayMode}
        pulse={pulse}
      />
      {consumed > 0 && target > 0 ? (
        <div
          className="grid w-full grid-cols-3 border-t border-border pt-3 mt-1"
          data-testid="today-ring-stats-row"
        >
          <RingStatCell
            label="Goal"
            value={Math.round(target).toLocaleString()}
          />
          <RingStatCell
            label="Eaten"
            value={Math.round(consumed).toLocaleString()}
            divider
          />
          {isOver ? (
            <RingStatCell
              label="Over"
              value={`−${Math.round(consumed - target).toLocaleString()}`}
              valueClassName="text-[var(--over-budget-fg)]"
              divider
            />
          ) : (
            <RingStatCell
              label="Bonus"
              value={bonusKcal > 0 ? `+${bonusKcal.toLocaleString()}` : "0"}
              labelClassName={bonusKcal > 0 ? "text-success" : "text-foreground-tertiary"}
              valueClassName={bonusKcal > 0 ? "text-success" : "text-foreground-tertiary"}
              divider
            />
          )}
        </div>
      ) : null}
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
