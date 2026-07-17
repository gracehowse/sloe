"use client";

import { ScreenChrome } from "./screen-chrome";
import { SegmentedTrack } from "../ui/segmented-track";
import { SubTabPill } from "../ui/sub-tab-pill";
import { isFeatureEnabled } from "@/lib/analytics/track";

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
      {/* ENG-1532 component-grammar dedup — sub-tab switchers are the §8
          SegmentedTrack pill; the Shopping unchecked-count badge rides the
          track's per-option `badge`. Flag-off renders the legacy SubTabPill
          underline tabs byte-intact (kill switch). */}
      {isFeatureEnabled("component_grammar_dedup") ? (
        <div className="px-6 pb-3">
          <SegmentedTrack<PlanTab>
            options={[
              { value: "plan", label: "This week" },
              { value: "shopping", label: "Shopping", badge: shoppingUncheckedCount },
            ]}
            value={activeId}
            onChange={onSelect}
            ariaLabel="Plan sections"
          />
        </div>
      ) : (
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
      )}
    </ScreenChrome>
  );
}
