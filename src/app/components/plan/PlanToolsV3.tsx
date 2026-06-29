"use client";

import * as React from "react";
import { ChevronRight, Flame, ShoppingCart } from "lucide-react";

/**
 * PlanToolsV3 — the Sloe v3 Plan "plan tool" rows at the foot of the meal body.
 *
 * WEB parity twin of `apps/mobile/components/plan/PlanToolsV3.tsx` (prototype
 * `plan-tool` ~L4820-4826): 2-up Batch cook + Shopping list (ENG-1255 / B3).
 * Behind sloe_v3_plan.
 */
export interface PlanToolsV3Props {
  batchCookSubtitle: string;
  shoppingItemCount: number;
  servingCount: number;
  onOpenBatchCook: () => void;
  onOpenShopping: () => void;
}

function ToolButton({
  icon,
  title,
  subtitle,
  onClick,
  ariaLabel,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex w-full min-w-0 items-center gap-2 rounded-xl border p-3 text-left transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:bg-[var(--background-secondary)] active:scale-[0.99]"
      style={{
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--accent-primary-soft)" }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-foreground">{title}</span>
        <span className="mt-px block truncate text-[10px] tabular-nums text-foreground-tertiary">
          {subtitle}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-foreground-tertiary" />
    </button>
  );
}

export function PlanToolsV3({
  batchCookSubtitle,
  shoppingItemCount,
  servingCount,
  onOpenBatchCook,
  onOpenShopping,
}: PlanToolsV3Props) {
  const forN = servingCount > 1 ? ` · for ${servingCount}` : "";
  const shopSub =
    shoppingItemCount > 0
      ? `${shoppingItemCount} item${shoppingItemCount === 1 ? "" : "s"}${forN}`
      : `Build your basket${forN}`;

  return (
    <div className="mt-3 space-y-2">
      <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-foreground-tertiary">
        This week
      </p>
      <div className="grid grid-cols-2 gap-2">
        <ToolButton
          icon={<Flame className="size-[18px]" strokeWidth={1.9} style={{ color: "var(--primary)" }} />}
          title="Batch cook"
          subtitle={batchCookSubtitle}
          onClick={onOpenBatchCook}
          ariaLabel={`Batch cook, ${batchCookSubtitle}`}
        />
        <ToolButton
          icon={
            <ShoppingCart
              className="size-[18px]"
              strokeWidth={1.9}
              style={{ color: "var(--primary)" }}
            />
          }
          title="Shopping list"
          subtitle={shopSub}
          onClick={onOpenShopping}
          ariaLabel={`Shopping list, ${shopSub}`}
        />
      </div>
    </div>
  );
}

export default PlanToolsV3;
