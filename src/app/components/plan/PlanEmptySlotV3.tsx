"use client";

import * as React from "react";
import { Plus } from "lucide-react";

/**
 * PlanEmptySlotV3 — Sloe v3 Plan empty-slot row.
 *
 * WEB parity twin of `apps/mobile/components/plan/PlanEmptySlotV3.tsx`
 * (prototype `plan-empty` ~L4787): a dashed card with the slot label and an
 * "Add {slot}" affordance. Behind sloe_v3_plan.
 */
export interface PlanEmptySlotV3Props {
  /** Slot label, e.g. "Dinner". */
  slot: string;
  onPress: () => void;
}

export function PlanEmptySlotV3({ slot, onPress }: PlanEmptySlotV3Props) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`Add ${slot.toLowerCase()}`}
      className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl border border-dashed px-4 py-3 transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:bg-[var(--background-secondary)] active:scale-[0.99]"
      style={{ borderColor: "var(--border-strong)" }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-foreground-tertiary">
        {slot}
      </span>
      <span className="flex items-center gap-1" style={{ color: "var(--primary)" }}>
        <Plus className="size-[15px]" strokeWidth={2.25} />
        <span className="text-[13px] font-semibold">
          Add {slot.toLowerCase()}
        </span>
      </span>
    </button>
  );
}

export default PlanEmptySlotV3;
