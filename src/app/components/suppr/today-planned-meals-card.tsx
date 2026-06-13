"use client";

import * as React from "react";
import { formatPlannedMealMacroParts } from "@/lib/nutrition/plannedMealDisplay";
import Link from "next/link";
import { Icons } from "../ui/icons";
import { SupprCard } from "../ui/suppr-card";
import type { DayPlanMeal } from "../../../types/recipe.ts";

/**
 * TodayPlannedMealsCard (web) — mirrors mobile
 * `apps/mobile/components/today/TodayPlannedMealsCard.tsx`. Renders the
 * meal-plan rows for today that haven't been logged yet, with a quick
 * portion picker (½× / 1× / 1½× / 2×) so the user can one-tap log a
 * planned meal at a non-default serving.
 *
 * Visibility / empty state: when `today_planned_empty_state` is ON the host
 * mounts this card even on empty days; the card then renders an empty-state
 * branch carrying the SAME card shell + "Planned" header, a calm one-liner
 * ("Nothing planned for today"), and a ghost "Plan your day →" link into the
 * Plan tab — so the Today scroll keeps its section grammar whether or not a
 * plan exists (F-178/F-179, ENG-1065). Flag OFF: parent only mounts the card
 * when `plannedMeals.length > 0`, the prior hide-when-empty behaviour. Mobile
 * parity: `apps/mobile/components/today/TodayPlannedMealsCard.tsx`.
 */

export interface TodayPlannedMealsCardProps {
  plannedMeals: DayPlanMeal[];
  onLogPlannedMealWithPortion: (meal: DayPlanMeal, portion: number) => void;
}

const PORTIONS: ReadonlyArray<{ label: string; value: number }> = [
  { label: "½×", value: 0.5 },
  { label: "1×", value: 1 },
  { label: "1½×", value: 1.5 },
  { label: "2×", value: 2 },
];

export function TodayPlannedMealsCard({
  plannedMeals,
  onLogPlannedMealWithPortion,
}: TodayPlannedMealsCardProps) {
  const isEmpty = plannedMeals.length === 0;

  return (
    <SupprCard
      elevation="card"
      padding="none"
      radius="lg"
      className="mb-6"
      aria-label="Planned meals for today"
    >
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <h3 className="text-sm font-bold tracking-tight text-foreground-brand">Planned</h3>
      </header>
      {isEmpty ? (
        <div className="flex flex-col items-start gap-3 px-4 pb-4">
          <p className="text-sm text-muted-foreground">Nothing planned for today</p>
          <Link
            href="/plan"
            className="text-sm font-bold text-primary-solid hover:underline focus:outline-none focus-visible:underline"
          >
            Plan your day →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {plannedMeals.map((meal, i) => (
            <PlannedMealRow
              key={`planned-${i}-${meal.recipeTitle ?? meal.name}`}
              meal={meal}
              onLog={(portion) => onLogPlannedMealWithPortion(meal, portion)}
            />
          ))}
        </ul>
      )}
    </SupprCard>
  );
}

function PlannedMealRow({
  meal,
  onLog,
}: {
  meal: DayPlanMeal;
  onLog: (portion: number) => void;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const calories = Math.round(meal.calories ?? 0);
  const protein = Math.round(meal.protein ?? 0);
  const carbs = Math.round(meal.carbs ?? 0);
  const fat = Math.round(meal.fat ?? 0);
  const title = meal.recipeTitle ?? meal.name;

  // D2 (wave-2 parity review): macro line comes from the SAME shared
  // formatter as mobile (number-first "28g P"), not a hand-rolled
  // label-first string that can drift.
  const parts = formatPlannedMealMacroParts(
    Number(calories) || 0,
    Number(protein) || 0,
    Number(carbs) || 0,
    Number(fat) || 0,
  );

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate opacity-80">
          {title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
          {parts.kcal} kcal · {parts.protein}g P · {parts.carbs}g C · {parts.fat}g F
        </p>
      </div>
      <div className="relative">
        {pickerOpen ? (
          <div
            className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5 shadow-md"
            role="group"
            aria-label="Choose portion"
          >
            {PORTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  onLog(p.value);
                  setPickerOpen(false);
                }}
                className="px-2 py-1 rounded text-xs font-bold tabular-nums text-foreground hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              aria-label="Cancel"
              className="ml-1 px-1.5 py-1 rounded text-muted-foreground hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icons.close className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="text-xs font-bold text-primary-solid hover:underline focus:outline-none focus-visible:underline"
          >
            Log today
          </button>
        )}
      </div>
    </li>
  );
}
