import React from "react";

import { ScreenSectionChrome } from "@/components/suppr/screen-section-chrome";
import { PlanSubTabHeader, type PlanSubTab } from "@/components/tabs/PlanSubTabHeader";

export interface PlanTabChromeProps {
  value: PlanSubTab;
  onChange: (next: PlanSubTab) => void;
  shoppingUncheckedCount?: number;
  subtitle?: string;
  /** Defaults to "Meal plan" on This week; "Shopping list" on Shopping. */
  title?: string;
}

/** Sticky Plan header — brand, title, week subtitle, This week / Shopping tabs. */
export function PlanTabChrome({
  value,
  onChange,
  shoppingUncheckedCount = 0,
  subtitle,
  title = "Meal plan",
}: PlanTabChromeProps) {
  return (
    <ScreenSectionChrome
      testID="plan-tab-chrome"
      overline="Plan"
      title={title}
      subtitle={subtitle}
    >
      <PlanSubTabHeader
        value={value}
        onChange={onChange}
        shoppingUncheckedCount={shoppingUncheckedCount}
      />
    </ScreenSectionChrome>
  );
}

export default PlanTabChrome;
