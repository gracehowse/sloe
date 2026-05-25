"use client";

import { SubTabPill } from "../ui/sub-tab-pill";
import { cn } from "../ui/utils";

export type PlanTab = "plan" | "shopping";

export interface PlanTabChromeProps {
  activeId: PlanTab;
  onSelect: (id: PlanTab) => void;
  shoppingUncheckedCount?: number;
  subtitle?: string;
  title?: string;
  className?: string;
}

/**
 * Sticky Plan header for mobile-web — mirrors mobile `PlanTabChrome`.
 */
export function PlanTabChrome({
  activeId,
  onSelect,
  shoppingUncheckedCount = 0,
  subtitle,
  title = "Meal plan",
  className,
}: PlanTabChromeProps) {
  return (
    <header
      className={cn(
        "md:hidden sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md",
        className,
      )}
      data-testid="plan-tab-chrome"
    >
      <div className="px-6 pt-2 pb-1 space-y-0.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Plan
        </p>
        <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">{title}</h1>
        {subtitle ? (
          <p className="text-[13px] font-semibold text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <SubTabPill
        embedded
        items={[
          { id: "plan", label: "This week" },
          { id: "shopping", label: "Shopping", badge: shoppingUncheckedCount },
        ]}
        activeId={activeId}
        onSelect={onSelect}
        accessibilityLabel="Plan sections"
        className="pt-0 pb-3"
      />
    </header>
  );
}
