"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, Sparkles } from "lucide-react";
import { DailyRing, type CalorieRingDisplayMode } from "./daily-ring";
import { MACRO_RING_TOGGLE, todayStatusChip } from "../../../lib/copy/today";
import { useCalorieRingGeometry } from "../../../lib/hooks/useCalorieRingGeometry";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
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
  /** @deprecated 2026-06-10 (web ring parity 2026-06-10) — the
   *  Remaining/Consumed toggle is retired; ignored. Kept for call-site
   *  stability. */
  displayMode?: CalorieRingDisplayMode;
  /** @deprecated 2026-06-10 (web ring parity 2026-06-10) — ignored. */
  onToggleDisplayMode?: () => void;
  onPressWhy?: () => void;
  pulse?: boolean;
}

type ChipState = "empty" | "under" | "over";

function HeroStatusChip({ state }: { state: ChipState }) {
  const tierV1 = isFeatureEnabled("today_tracker_tier_v1");
  const config =
    state === "over"
      ? {
          label: todayStatusChip("over"),
          className: tierV1
            ? "bg-warning-soft text-warning"
            : "bg-destructive/10 text-destructive-solid",
          Icon: CircleAlert,
        }
      : state === "empty"
        ? {
            label: todayStatusChip("empty"),
            className: tierV1
              ? "text-foreground-brand"
              : "bg-ring-bg text-foreground-brand",
            Icon: Sparkles,
          }
        : {
            label: todayStatusChip("under"),
            // AA fix (2026-06-16, mirror mobile sageInk): the "Under budget"
            // cue uses the SOLID sage (#466046, 6.95:1) for text/icon — the
            // lighter success (#5E7C5A) was only ~4:1 on its own tint.
            className: tierV1
              ? "text-success-solid"
              : "bg-success/20 text-success-solid",
            Icon: CircleCheck,
          };
  const { label, className, Icon } = config;
  return (
    <span
      data-testid="today-ring-status-chip"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      <Icon size={14} strokeWidth={2} aria-hidden />
      {label}
    </span>
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

export function TodayHeroRing({
  consumed,
  target,
  baseGoal,
  proteinPct,
  carbsPct,
  fatPct,
  expanded,
  onToggleExpanded,
  // displayMode / onToggleDisplayMode retired (web ring parity 2026-06-10) —
  // accepted on the prop API for call-site stability, ignored here.
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
      // elevation="card" (audit gap 6, 2026-06-09): the hero is the single
      // most important card on Today, yet it was explicitly flat — on the
      // near-tonal #F6F5F2-on-#FFFFFF pairing that made the whole top of the
      // screen read as one undifferentiated slab. The soft `.card-slab` shadow
      // separates it from the page like every other resting card. Mirrors
      // mobile `lift="soft"` on `TodayHeroRing.tsx`.
      elevation="card"
      radius="lg"
      padding="none"
      className="flex flex-col items-center mb-3 px-4 py-3 gap-2"
    >
      {/* Header row: the status chip only. The Remaining/Consumed segmented
          toggle is RETIRED (web ring parity 2026-06-10 — mobile ring wave): it
          duplicated the Eaten stat below the ring. */}
      <div className="flex w-full items-center justify-between gap-2">
        <HeroStatusChip state={chipState} />
      </div>
      <DailyRing
        consumed={consumed}
        target={target}
        size={ringGeometry.size}
        // ENG-1064 (TF57 F-164/165): multi-ring (expanded) hero stroke matches
        // the macro stroke; the collapsed lone ring keeps the confident bold
        // stroke. Mirrors mobile `ringGeometry(false, !expanded)`.
        strokeWidth={
          expanded ? ringGeometry.strokeWidth : ringGeometry.strokeWidthBold
        }
        ringRadius={ringGeometry.radius}
        macroRadii={ringGeometry.macroRadii}
        macroStroke={ringGeometry.macroStroke}
        proteinPct={proteinPct}
        carbsPct={carbsPct}
        fatPct={fatPct}
        expanded={expanded}
        onToggle={onToggleExpanded}
        pulse={pulse}
      />
      {/* Goal / Eaten / Bonus stats row — renders on EMPTY days too (web ring
          parity 2026-06-10): the empty page mirrors a populated day, so Eaten 0
          and Bonus +0 are honest numbers, not noise. Gated on `target > 0`
          (no profile target yet → no row), mirroring mobile `TodayHeroRing`. */}
      {target > 0 ? (
        <div
          className="grid w-full grid-cols-3 border-t border-border pt-2"
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
          {/* The right stat is ALWAYS Bonus (web ring parity 2026-06-10): the
              over amount reads in the ring centre + the status chip, and the
              old slot-switch hid the earned-burn number exactly when an
              over-budget user most wants to see it. 0 when no bonus. */}
          <RingStatCell
            label="Bonus"
            value={bonusKcal > 0 ? `+${bonusKcal.toLocaleString()}` : "0"}
            labelClassName={bonusKcal > 0 ? "text-success" : "text-foreground-secondary"}
            valueClassName={bonusKcal > 0 ? "text-success" : "text-foreground-secondary"}
            divider
          />
        </div>
      ) : null}
      <button
        type="button"
        data-testid="today-macro-rings-toggle"
        onClick={onToggleExpanded}
        // ENG-1093 (Grace): "Hide macros" / "Show macros" share one width so the
        // centred control never wobbles between states (the two strings are equal
        // length but "Show"/"Hide" differ in glyph width). `min-w` + centred text
        // pins both labels to one footprint. Mirrors mobile `minWidth: 84`.
        className="inline-block min-w-[84px] text-center text-[11px] font-semibold text-primary-solid hover:opacity-80 transition-opacity"
      >
        {expanded ? MACRO_RING_TOGGLE.hide : MACRO_RING_TOGGLE.show}
      </button>
    </SupprCard>
  );
}
