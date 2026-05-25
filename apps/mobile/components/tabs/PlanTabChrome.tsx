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
  /** Settings / overflow — sits in the title row (replaces a sparse header band). */
  trailing?: React.ReactNode;
}

/** Sticky Plan header — brand, title, week subtitle, This week / Shopping tabs. */
export function PlanTabChrome({
  value,
  onChange,
  shoppingUncheckedCount = 0,
  subtitle,
  title = "Meal plan",
  trailing,
}: PlanTabChromeProps) {
  return (
    <ScreenSectionChrome
      testID="plan-tab-chrome"
      // 2026-05-22 evening (Grace): drop redundant "PLAN" overline —
      // the bottom tab bar already says Plan. Title + subtitle alone
      // is enough.
      overline={null}
      title={title}
      subtitle={subtitle}
      trailing={trailing}
      compact
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
