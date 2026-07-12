"use client";

import { ScreenChrome } from "./screen-chrome";
import { SubTabPill } from "../ui/sub-tab-pill";

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
 * Thin wrapper over the shared `ScreenChrome` since S6 (2026-07-10,
 * ENG-1375); the overline moved from muted to the shared tertiary ink.
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
    <ScreenChrome
      overline="Plan"
      title={title}
      subtitle={subtitle}
      className={className}
      testID="plan-tab-chrome"
    >
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
    </ScreenChrome>
  );
}
