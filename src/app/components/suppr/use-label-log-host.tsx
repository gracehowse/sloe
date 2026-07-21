"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import type { FoodLoggedSource } from "../../../lib/analytics/events";
import {
  NUTRITION_LABEL_SOURCE,
  type LabelLogItem,
} from "../../../lib/nutrition/labelLogging";
import type { LoggedMeal } from "../../../types/recipe";
import { LabelLogDialog } from "./label-log-dialog";

type AddLoggedMeal = (
  meal: Omit<LoggedMeal, "id">,
  analyticsSource?: FoodLoggedSource,
) => string;

export function useLabelLogHost({
  addLoggedMeal,
  mealSlot,
  timeLabel,
  onBeforeOpen,
}: {
  addLoggedMeal: AddLoggedMeal;
  mealSlot: string;
  timeLabel: string;
  onBeforeOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const openLabelLog = useCallback(() => {
    onBeforeOpen();
    setOpen(true);
  }, [onBeforeOpen]);

  const commit = useCallback(
    (item: LabelLogItem) => {
      const micros: Record<string, number> = {};
      if (item.sugarG != null) micros.sugarG = item.sugarG;
      if (item.saturatedFatG != null) micros.saturatedFatG = item.saturatedFatG;
      if (item.sodiumMg != null) micros.sodiumMg = item.sodiumMg;
      addLoggedMeal(
        {
          name: mealSlot,
          recipeTitle: item.name,
          time: timeLabel,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          ...(item.fiberG != null ? { fiberG: item.fiberG } : {}),
          ...(Object.keys(micros).length > 0 ? { micros } : {}),
          source: NUTRITION_LABEL_SOURCE,
        },
        "label",
      );
      toast.success(`Logged ${item.name} from its nutrition label.`);
    },
    [addLoggedMeal, mealSlot, timeLabel],
  );

  return {
    openLabelLog,
    labelLogDialog: (
      <LabelLogDialog
        open={open}
        onOpenChange={setOpen}
        activeSlot={mealSlot}
        onCommit={commit}
      />
    ),
  };
}
