"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

/**
 * PlanEmptyWeekCard — ENG-1372 (empty-state grammar, Plan empty-week). When
 * the whole week has zero planned meals, this ONE warm invitation card
 * replaces:
 *   - the dashed-box wall (`PlanEmptySlotV3` × every slot × every day), and
 *   - the "0 of 7 days on target" verdict row (`PlanHeaderV3`) + the "0 / 1,900" /
 *     "P 0g C 0g F 0g" zero-triad (`PlanDayDetailBandV3`) — derived numbers
 *     with nothing behind them yet (law 3).
 *
 * Ground is the cool plum nudge-tint (`bg-primary-soft`) — law 1 still holds
 * (never a bare/dashed void), but the ENG-1372 warm-tint beige was overturned
 * by ENG-1496 (Grace 2026-07-10: beige reads bad; empty states live on the
 * cool light-purple family — the ENG-1477 ring call, and the v3 prototype
 * quarantines beige to marketing surfaces). ONE filled action inside it
 * (law 2): "Generate this week", wired to the host's existing generate
 * handler (same action `PlanHeaderV3`'s Sparkles button already fires) + a
 * quiet ghost fallback for users who'd rather add meals one at a time.
 *
 * Behind `empty_state_grammar_v1` — the host (`PlanV3Surface`) only mounts
 * this when the flag is on AND `isPlanWeekEmpty` is true; this component
 * itself carries no gating logic.
 *
 * Mobile parity: `apps/mobile/components/plan/PlanEmptyWeekCard.tsx`.
 */
export interface PlanEmptyWeekCardProps {
  onGenerate: () => void;
  onAddMealsAsYouGo: () => void;
}

export function PlanEmptyWeekCard({
  onGenerate,
  onAddMealsAsYouGo,
}: PlanEmptyWeekCardProps) {
  return (
    <div
      data-testid="plan-empty-week-card"
      className="mt-2 flex flex-col items-center gap-1 rounded-card-lg bg-primary-soft px-5 py-8 text-center"
    >
      <Sparkles className="size-[22px] text-foreground-brand" strokeWidth={1.75} aria-hidden />
      <p className="mt-1 font-[family-name:var(--font-headline)] text-[18px] font-medium text-foreground">
        Nothing planned yet
      </p>
      <p className="max-w-sm text-[13px] text-foreground-secondary">
        Generate a full week from your saved recipes, or build it meal by meal.
      </p>
      <button
        type="button"
        onClick={onGenerate}
        className="mt-2 rounded-full bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Generate this week
      </button>
      <button
        type="button"
        onClick={onAddMealsAsYouGo}
        className="mt-1 text-[13px] font-semibold text-primary-solid underline underline-offset-2 transition-opacity hover:opacity-80"
      >
        or add meals as you go
      </button>
    </div>
  );
}

export default PlanEmptyWeekCard;
