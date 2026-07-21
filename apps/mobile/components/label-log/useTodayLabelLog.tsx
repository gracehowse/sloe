import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

import { isFeatureEnabled, track } from "@/lib/analytics";
import { defaultEatenAtForNewLog } from "@suppr/nutrition-core/mealEatenAt";
import {
  NUTRITION_LABEL_SOURCE,
  type LabelLogItem,
} from "@suppr/nutrition-core/labelLogging";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { newMealId, type ByDay, type JournalMeal } from "@/lib/nutritionJournal";
import LabelLogSheet from "../LabelLogSheet";
import type { LabelLogReviewTheme } from "./LabelLogReview";

export function useTodayLabelLog({
  activeMealSlot,
  accessToken,
  apiBase,
  colors,
  dayKey,
  profileTimeZone,
  persistMealsImmediate,
  setByDay,
  onBeforeOpen,
}: {
  activeMealSlot: string;
  accessToken?: string | null;
  apiBase: string;
  colors: LabelLogReviewTheme;
  dayKey: string;
  profileTimeZone?: string | null;
  persistMealsImmediate: (dayKey: string, meals: JournalMeal[]) => Promise<boolean>;
  setByDay: Dispatch<SetStateAction<ByDay>>;
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
      const meal: JournalMeal = {
        id: newMealId(),
        name: activeMealSlot,
        recipeTitle: item.name,
        time: new Date().toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }),
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        ...(item.fiberG != null ? { fiberG: item.fiberG } : {}),
        ...(Object.keys(micros).length > 0 ? { micros } : {}),
        source: NUTRITION_LABEL_SOURCE,
        ...(isFeatureEnabled("editable_eaten_at")
          ? { eatenAt: defaultEatenAtForNewLog(dayKey, profileTimeZone) }
          : {}),
      };
      setByDay((current) => ({
        ...current,
        [dayKey]: [...(current[dayKey] ?? []), meal],
      }));
      void persistMealsImmediate(dayKey, [meal]);
      track(AnalyticsEvents.food_logged, { source: "label", count: 1 });
    },
    [activeMealSlot, dayKey, persistMealsImmediate, profileTimeZone, setByDay],
  );

  return {
    openLabelLog,
    labelLogSheet: (
      <LabelLogSheet
        visible={open}
        onClose={() => setOpen(false)}
        activeSlot={activeMealSlot}
        accessToken={accessToken}
        apiBase={apiBase}
        onCommit={commit}
        colors={colors}
      />
    ),
  };
}
