"use client";

/**
 * ENG-1238 — v3 Plan per-meal action sheet (web).
 * Mirrors the legacy MealPlanner dropdown actions for the v3 card surface.
 */
import * as React from "react";

import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import type { DayPlan } from "@/types/recipe";

export interface PlanMealActionDialogProps {
  open: boolean;
  meal: DayPlan["meals"][number] | null;
  onClose: () => void;
  onLogToday: () => void;
  onViewRecipe: () => void;
  onSwap: () => void;
  onChangePortion: () => void;
  onMove: () => void;
  onRemove: () => void;
  lockEnabled?: boolean;
  onToggleLock?: () => void;
  isLocked?: boolean;
}

export function PlanMealActionDialog({
  open,
  meal,
  onClose,
  onLogToday,
  onViewRecipe,
  onSwap,
  onChangePortion,
  onMove,
  onRemove,
  lockEnabled,
  onToggleLock,
  isLocked,
}: PlanMealActionDialogProps) {
  if (!meal) return null;
  const title = meal.recipeTitle || meal.name || "Meal";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm gap-2">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          {lockEnabled && onToggleLock ? (
            <Button variant="ghost" className="justify-start" onClick={onToggleLock}>
              {isLocked ? "Unlock this meal" : "Keep this meal"}
            </Button>
          ) : null}
          <Button variant="ghost" className="justify-start" onClick={onLogToday}>
            Log today
          </Button>
          <Button variant="ghost" className="justify-start" onClick={onViewRecipe}>
            View recipe
          </Button>
          <Button variant="ghost" className="justify-start" onClick={onSwap}>
            Swap meal
          </Button>
          <Button variant="ghost" className="justify-start" onClick={onChangePortion}>
            Change portion size…
          </Button>
          <Button variant="ghost" className="justify-start" onClick={onMove}>
            Move to different slot
          </Button>
          <Button
            variant="ghost"
            className="justify-start text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            Remove from plan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
