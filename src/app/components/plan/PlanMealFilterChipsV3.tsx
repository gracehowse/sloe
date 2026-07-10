"use client";

import * as React from "react";

import { FilterChip } from "../ui/filter-chip";

/**
 * PlanMealFilterChipsV3 — Sloe v3 Plan meal-filter chip row.
 *
 * WEB parity twin of `apps/mobile/components/plan/PlanMealFilterChipsV3.tsx`
 * (prototype `plan-mealfilter` ~L4745-4749): All meals / Breakfast / Lunch /
 * Dinner / Snack. "All" shows the day-detail view; a specific slot switches the
 * body to the across-week list. Horizontally scrollable, edge-bleeding the
 * host's 20px gutter (`-mx-5`). Behind sloe_v3_plan.
 *
 * Chip ruling 2026-07-10 (ENG-1375 S1,
 * `docs/decisions/2026-07-10-chip-grammar-soft-tint.md`): selection is the
 * shared §7 FilterChip soft tint — the previous solid `--primary` fill is
 * reserved for DAY CELLS in the week strip, not filter chips.
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
            <FilterChip
              key={f}
              label={label}
              selected={active}
              size="md"
              aria-label={label}
              onClick={() => onSelect(f)}
              className="active:scale-95 transition-[background-color,transform]"
            />
          );
        })}
      </div>
    </div>
  );
}

export default PlanMealFilterChipsV3;
