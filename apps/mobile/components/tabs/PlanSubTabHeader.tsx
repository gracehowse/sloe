import React from "react";
import { View } from "react-native";

import { SegmentedTrack } from "@/components/ui/SegmentedTrack";
import { SubTabPill } from "@/components/ui/SubTabPill";
import { Spacing } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";

/**
 * PlanSubTabHeader — segmented sub-tab bar shown at the top of
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
 * ENG-1532 (component-grammar dedup): renders the §8 `SegmentedTrack`
 * pill, with the Shopping unchecked-count badge carried by the track's
 * per-option `badge` (hidden at 0, "999+" cap). Flag-off renders the
 * legacy `SubTabPill` underline tabs byte-intact (kill switch) — its
 * badge behaviour unchanged.
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
  if (isFeatureEnabled("component_grammar_dedup")) {
    return (
      <View
        style={{
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing.sm,
          paddingBottom: Spacing.lg,
        }}
      >
        <SegmentedTrack<PlanSubTab>
          role="tablist"
          options={[
            { value: "plan", label: "This week", accessibilityLabel: "This week" },
            {
              value: "shopping",
              label: "Shopping list",
              accessibilityLabel: "Shopping list",
              badge: shoppingUncheckedCount,
            },
          ]}
          value={value}
          onChange={onChange}
          accessibilityLabel="Plan sections"
        />
      </View>
    );
  }

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
