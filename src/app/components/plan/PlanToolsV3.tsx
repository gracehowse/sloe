"use client";

import * as React from "react";
import { ChevronRight, ShoppingCart } from "lucide-react";

/**
 * PlanToolsV3 — the Sloe v3 Plan "plan tool" rows at the foot of the meal body.
 *
 * WEB parity twin of `apps/mobile/components/plan/PlanToolsV3.tsx` (prototype
 * `plan-tool` ~L4820-4826): a plum-frost icon box + title + count subtitle.
 * Ships the Shopping list row (cart → the existing shopping screen), restoring
 * shopping access carried by the legacy chrome that's hidden under sloe_v3_plan.
 * The prototype's Batch cook row is a tracked follow-up (no batch-cook sheet yet
 * — ENG-1225). Behind sloe_v3_plan.
 */
export interface PlanToolsV3Props {
  /** Current shopping-list item count (0 → a "build your basket" nudge). */
  shoppingItemCount: number;
  /** Household serving count (>1 appends "· for N"). */
  servingCount: number;
  onOpenShopping: () => void;
}

export function PlanToolsV3({
  shoppingItemCount,
  servingCount,
  onOpenShopping,
}: PlanToolsV3Props) {
  const forN = servingCount > 1 ? ` · for ${servingCount}` : "";
  const sub =
    shoppingItemCount > 0
      ? `${shoppingItemCount} item${shoppingItemCount === 1 ? "" : "s"}${forN}`
      : `Build your basket${forN}`;
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onOpenShopping}
        aria-label={`Shopping list, ${sub}`}
        className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:bg-[var(--background-secondary)] active:scale-[0.99]"
        style={{
          backgroundColor: "var(--card)",
          borderColor: "var(--border)",
        }}
      >
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--accent-primary-soft)" }}
        >
          <ShoppingCart
            className="size-[18px]"
            strokeWidth={1.9}
            style={{ color: "var(--primary)" }}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-foreground">
            Shopping list
          </span>
          <span className="mt-px block text-[11px] tabular-nums text-foreground-tertiary">
            {sub}
          </span>
        </span>
        <ChevronRight className="size-[18px] shrink-0 text-foreground-tertiary" />
      </button>
    </div>
  );
}

export default PlanToolsV3;
