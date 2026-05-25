import React from "react";

import { SubTabPill } from "@/components/ui/SubTabPill";

/**
 * PlanSubTabHeader — segmented sub-tab pill bar shown at the top of
 * the Plan tab to flip between the weekly Plan and Shopping list
 * sub-views once the 6→4 tab collapse landed (Phase 2 / B1.1,
 * 2026-04-27 strategic spec).
 *
 * Per D-2026-04-27-02:
 *   "Plan (planner + shopping list as sub-view)"
 * and the production design spec, Surface D:
 *   "Plan is sit-down. Shopping is supermarket-phone."
 *
 * Unlike Recipes / You sub-tabs (which switch between separate route
 * files via `router.replace`), Shopping is rendered inline within the
 * existing planner screen via a state toggle, so this header is
 * purely a visual segmented control whose `value` and `onChange` are
 * owned by the planner host.
 *
 * Refactored 2026-04-28 (Next-10 #13 from the teardown doc) to use
 * the shared `<SubTabPill>` primitive at
 * `apps/mobile/components/ui/SubTabPill.tsx`. The Shopping pill's
 * unread-count badge is exposed via `items[1].badge` — the primitive
 * renders the pill counter natively (≤99 / "99+" formatting included).
 */
export type PlanSubTab = "plan" | "shopping";

export interface PlanSubTabHeaderProps {
  value: PlanSubTab;
  onChange: (next: PlanSubTab) => void;
  shoppingUncheckedCount?: number;
}

export function PlanSubTabHeader({
  value,
  onChange,
  shoppingUncheckedCount = 0,
}: PlanSubTabHeaderProps) {
  return (
    <SubTabPill<PlanSubTab>
      items={[
        { id: "plan", label: "This week" },
        { id: "shopping", label: "Shopping list", badge: shoppingUncheckedCount },
      ]}
      activeId={value}
      onSelect={onChange}
      accessibilityLabel="Plan sections"
    />
  );
}

export default PlanSubTabHeader;
