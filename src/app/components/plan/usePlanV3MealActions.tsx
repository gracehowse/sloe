"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";

import type { DayPlan } from "@/types/recipe";
import { PlanMealActionDialog } from "./PlanMealActionDialog.tsx";

type SlotKey = "breakfast" | "lunch" | "dinner" | "snacks";

export interface UsePlanV3MealActionsArgs {
  plan: DayPlan[];
  slots: readonly SlotKey[];
  mealLockEnabled: boolean;
  onOpenRecipe?: (recipeId: string) => void;
  openSwap: (day: number, slot: SlotKey, mealIndex: number) => void;
  handleLogToday: (meal: DayPlan["meals"][number]) => void;
  setPortionTarget: Dispatch<
    SetStateAction<{ day: number; mealIndex: number } | null>
  >;
  setMoveFrom: Dispatch<SetStateAction<{ day: number; slotIndex: number } | null>>;
  setMealPlan: Dispatch<SetStateAction<DayPlan[] | null>>;
  toggleMealLock: (day: number, mealIndex: number, slot: SlotKey) => void;
}

/** ENG-1238 — v3 Plan per-meal action sheet state + dialog host for MealPlanner. */
export function usePlanV3MealActions({
  plan,
  slots,
  mealLockEnabled,
  onOpenRecipe,
  openSwap,
  handleLogToday,
  setPortionTarget,
  setMoveFrom,
  setMealPlan,
  toggleMealLock,
}: UsePlanV3MealActionsArgs) {
  const [v3MealMenu, setV3MealMenu] = useState<{
    dayIndex: number;
    slotIndex: number;
  } | null>(null);

  const openV3Meal = useCallback(
    (dayIndex: number, slotIndex: number) => {
      const dp = plan[dayIndex];
      const meal = dp?.meals[slotIndex];
      if (!meal || meal.isPlaceholder) {
        if (dp) openSwap(dp.day, slots[slotIndex] ?? "snacks", slotIndex);
        return;
      }
      const recipeId = (meal as { recipeId?: string }).recipeId;
      if (recipeId && onOpenRecipe) onOpenRecipe(recipeId);
      else if (dp) openSwap(dp.day, slots[slotIndex] ?? "snacks", slotIndex);
    },
    [plan, onOpenRecipe, openSwap, slots],
  );

  const openV3MealOptions = useCallback((dayIndex: number, slotIndex: number) => {
    setV3MealMenu({ dayIndex, slotIndex });
  }, []);

  const closeMenu = useCallback(() => setV3MealMenu(null), []);

  const mealActionDialog = (() => {
    if (!v3MealMenu) return null;
    const dp = plan[v3MealMenu.dayIndex];
    const meal = dp?.meals[v3MealMenu.slotIndex];
    if (!meal || !dp) return null;
    const slot = slots[v3MealMenu.slotIndex] ?? "snacks";
    const recipeId = (meal as { recipeId?: string }).recipeId;
    return (
      <PlanMealActionDialog
        open
        meal={meal}
        onClose={closeMenu}
        onLogToday={() => {
          handleLogToday(meal);
          closeMenu();
        }}
        onViewRecipe={() => {
          if (recipeId) onOpenRecipe?.(recipeId);
          closeMenu();
        }}
        onSwap={() => {
          openSwap(dp.day, slot, v3MealMenu.slotIndex);
          closeMenu();
        }}
        onChangePortion={() => {
          setPortionTarget({ day: dp.day, mealIndex: v3MealMenu.slotIndex });
          closeMenu();
        }}
        onMove={() => {
          setMoveFrom({ day: dp.day, slotIndex: v3MealMenu.slotIndex });
          closeMenu();
        }}
        onRemove={() => {
          setMealPlan((prev) => {
            if (!prev) return prev;
            return prev.map((row, di) => {
              if (di !== v3MealMenu.dayIndex) return row;
              const meals = row.meals.map((m, mi) =>
                mi === v3MealMenu.slotIndex
                  ? {
                      ...m,
                      recipeTitle: "",
                      calories: 0,
                      protein: 0,
                      carbs: 0,
                      fat: 0,
                      isPlaceholder: true,
                    }
                  : m,
              );
              const totals = meals.reduce(
                (acc, m) => ({
                  calories: acc.calories + (Number(m.calories) || 0),
                  protein: acc.protein + (Number(m.protein) || 0),
                  carbs: acc.carbs + (Number(m.carbs) || 0),
                  fat: acc.fat + (Number(m.fat) || 0),
                }),
                { calories: 0, protein: 0, carbs: 0, fat: 0 },
              );
              return { ...row, meals, totals };
            });
          });
          closeMenu();
          toast.success("Removed from plan");
        }}
        lockEnabled={mealLockEnabled}
        isLocked={Boolean(meal.isLocked)}
        onToggleLock={() => {
          toggleMealLock(dp.day, v3MealMenu.slotIndex, slot);
          closeMenu();
        }}
      />
    );
  })();

  return { openV3Meal, openV3MealOptions, mealActionDialog };
}
