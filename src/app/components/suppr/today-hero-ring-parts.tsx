"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, Sparkles } from "lucide-react";
import { todayStatusChip } from "../../../lib/copy/today";

export type ChipState = "empty" | "under" | "over";

export function HeroStatusChip({
  state,
  onPress,
}: {
  state: ChipState;
  onPress?: () => void;
}) {
  const config =
    state === "over"
      ? {
          label: todayStatusChip("over"),
          // ENG-1453: over-budget is AMBER in every state of every branch
          // (ENG-1296 — red retired product-wide). Semantic over-budget
          // tokens alias the warning family, so pixels match the previous
          // tierV1 pill exactly.
          className: "bg-over-budget-soft text-over-budget-fg",
          Icon: CircleAlert,
        }
      : state === "empty"
        ? {
            label: todayStatusChip("empty"),
            className: "text-foreground-brand",
            Icon: Sparkles,
          }
        : {
            label: todayStatusChip("under"),
            // AA fix (2026-06-16, mirror mobile sageInk): the "Under budget"
            // cue uses the SOLID sage (#466046, 6.95:1) for text/icon — the
            // lighter success (#5E7C5A) was only ~4:1 on its own tint.
            className: "text-success-solid",
            Icon: CircleCheck,
          };
  const { label, className, Icon } = config;
  const chipClassName = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`;
  if (!onPress) {
    return (
      <span data-testid="today-ring-status-chip" className={chipClassName}>
        <Icon size={14} strokeWidth={2} aria-hidden />
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      data-testid="today-ring-status-chip"
      onClick={onPress}
      aria-label={`${label}, see how your calorie target was set`}
      className={`${chipClassName} cursor-pointer transition-opacity hover:opacity-90`}
    >
      <Icon size={14} strokeWidth={2} aria-hidden />
      {label}
    </button>
  );
}

/**
 * HeroCoachChip — the always-present labelled Coach entry in the hero chip
 * row (ENG-1293). Same element, same treatment as the "Coach" pill on the
 * Coach screen header (`coach-screen.tsx`): frost-mist fill, plum Sparkles +
 * label. Mobile mirror: `TodayCoachChip` in
 * `apps/mobile/components/today/TodayHeroChips.tsx`.
 */
export function HeroCoachChip({ onPress }: { onPress: () => void }) {
  return (
    <button
      type="button"
      data-testid="today-coach-chip"
      onClick={onPress}
      aria-label="Open your coach"
      className="inline-flex items-center gap-1 rounded-full bg-accent-frost-mist px-2 py-0.5 text-xs font-medium text-primary-solid transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Sparkles className="h-3 w-3" aria-hidden />
      Coach
    </button>
  );
}

/**
 * RingStatusLine — the de-carded v3 hero's status indicator (ENG-1247): a
 * centered dot + label BELOW the ring (prototype `.ring-status`), replacing the
 * carded hero's chip-above-the-ring. Sage when under, over-budget AMBER when
 * over (ENG-1453 — the old over=red rule was retired by ENG-1296; mirrors
 * mobile); hidden on empty days. Copy from the shared `todayStatusChip`
 * helper (no drift). Web twin of mobile `RingStatusLine` in
 * `TodayHeroChips.tsx`.
 */
export function RingStatusLine({ state }: { state: ChipState }) {
  if (state === "empty") return null;
  const colorClass = state === "over" ? "text-over-budget-fg" : "text-success-solid";
  return (
    <div
      data-testid="today-ring-status-line"
      className={`flex items-center justify-center gap-1.5 ${colorClass}`}
    >
      <span className="inline-block h-[7px] w-[7px] rounded-full bg-current" />
      <span className="text-[13px] font-semibold">{todayStatusChip(state)}</span>
    </div>
  );
}

export function RingStatCell({
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
        // statLabel parity (2026-06-16): 11px / 600 / wide tracking in SECONDARY
        // ink (AA), not tertiary — a calm section label, not shouty sub-AA caps.
        className={`text-[11px] font-semibold uppercase tracking-wider ${labelClassName ?? "text-foreground-secondary"}`}
      >
        {label}
      </div>
      <div
        // statValue 18→22 (2026-06-16): reads as a real stat row, not a footnote.
        // 22 = on the type ramp (--text-xl); 20 was off-scale (ENG-119 lint).
        className={`mt-1 font-[family-name:var(--font-headline)] text-[22px] font-normal tabular-nums leading-tight ${valueClassName ?? "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

