"use client";

import { useMemo } from "react";
import type { DayPlan } from "../../../types/recipe.ts";
import { PORTION_MULTIPLIER_CLAMP } from "../../../lib/nutrition/mealPlanAlgo.ts";
import { effectivePortionMultiplier } from "../../../lib/nutrition/portionMultiplier.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

export type PortionTarget = { day: number; mealIndex: number } | null;

type RecipeRef = { id: string; title: string; calories: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: DayPlan[];
  target: PortionTarget;
  recipePool: RecipeRef[];
  onSelect: (multiplier: number) => void;
};

/** Legal portion steps from the shared planner clamp (0.5× … 2×, 0.5 step). */
export function plannerPortionMultiplierSteps(): number[] {
  const { min, max, step } = PORTION_MULTIPLIER_CLAMP;
  const inv = 1 / step;
  const out: number[] = [];
  for (let x = min; x <= max + 1e-9; x += step) {
    out.push(Math.round(x * inv) / inv);
  }
  return out;
}

/** Current display multiplier for a planner row (matches mobile `planMealPortionMeta`). */
export function planMealDisplayMultiplier(
  meal: DayPlan["meals"][number],
  pool: RecipeRef[],
): number {
  const pm = (meal as { portionMultiplier?: number }).portionMultiplier;
  if (typeof pm === "number" && Number.isFinite(pm) && Math.abs(pm - 1) > 0.001) {
    return effectivePortionMultiplier(pm);
  }
  const recipeId = (meal as { recipeId?: string }).recipeId;
  const ref =
    (recipeId ? pool.find((r) => r.id === recipeId) : undefined) ??
    pool.find((r) => r.title.trim() === meal.recipeTitle.trim());
  const rc = ref && Number(ref.calories) > 0 ? Number(ref.calories) : 0;
  if (!rc || !Number.isFinite(meal.calories) || meal.calories <= 0) return 1;
  const ratio = meal.calories / rc;
  if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 0.02) return 1;
  return effectivePortionMultiplier(ratio);
}

/**
 * Web parity for mobile portion picker — choose a multiplier; parent scales
 * row macros and persists the plan.
 */
export function PlanPortionDialog({
  open,
  onOpenChange,
  plan,
  target,
  recipePool,
  onSelect,
}: Props) {
  const steps = useMemo(() => plannerPortionMultiplierSteps(), []);

  const meal =
    target != null
      ? plan.find((d) => d.day === target.day)?.meals[target.mealIndex]
      : undefined;

  const currentMult = meal ? planMealDisplayMultiplier(meal, recipePool) : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card">
        <DialogHeader>
          <DialogTitle className="text-foreground">Portion size</DialogTitle>
          {meal ? (
            <DialogDescription className="text-muted-foreground line-clamp-2">
              {meal.recipeTitle || meal.name}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="flex flex-col">
          {steps.map((mult) => {
            const baseCals = meal ? meal.calories / currentMult : 0;
            const kcal = Math.round(baseCals * mult);
            const selected = Math.abs(mult - currentMult) < 0.01;
            return (
              <button
                key={mult}
                type="button"
                onClick={() => {
                  onSelect(mult);
                  onOpenChange(false);
                }}
                className={`flex items-center justify-between w-full px-1 py-3 border-t border-border text-left first:border-t-0 ${
                  selected ? "text-primary" : "text-foreground hover:bg-muted/50"
                }`}
              >
                <span className="text-base font-semibold tabular-nums">{mult}×</span>
                <span className="text-sm text-muted-foreground tabular-nums">~{kcal} kcal</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
