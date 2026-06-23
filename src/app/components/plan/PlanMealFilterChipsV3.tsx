"use client";

import * as React from "react";

/**
 * PlanMealFilterChipsV3 — Sloe v3 Plan meal-filter chip row.
 *
 * WEB parity twin of `apps/mobile/components/plan/PlanMealFilterChipsV3.tsx`
 * (prototype `plan-mealfilter` ~L4745-4749): All meals / Breakfast / Lunch /
 * Dinner / Snack. "All" shows the day-detail view; a specific slot switches the
 * body to the across-week list. Selected chip = plum fill. Horizontally
 * scrollable, edge-bleeding the host's 20px gutter (`-mx-5`). Behind sloe_v3_plan.
 */
export const PLAN_MEAL_FILTERS = [
  "All",
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
] as const;
export type PlanMealFilter = (typeof PLAN_MEAL_FILTERS)[number];

export interface PlanMealFilterChipsV3Props {
  selected: PlanMealFilter;
  onSelect: (filter: PlanMealFilter) => void;
}

export function PlanMealFilterChipsV3({
  selected,
  onSelect,
}: PlanMealFilterChipsV3Props) {
  return (
    <div className="-mx-5 mt-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-2 px-5">
        {PLAN_MEAL_FILTERS.map((f) => {
          const active = f === selected;
          const label = f === "All" ? "All meals" : f;
          return (
            <button
              key={f}
              type="button"
              aria-label={label}
              aria-pressed={active}
              onClick={() => onSelect(f)}
              className="shrink-0 rounded-full px-3 py-2 text-[13px] font-semibold transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95"
              style={{
                backgroundColor: active
                  ? "var(--primary)"
                  : "var(--background-secondary)",
                color: active
                  ? "var(--primary-foreground)"
                  : "var(--foreground)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PlanMealFilterChipsV3;
