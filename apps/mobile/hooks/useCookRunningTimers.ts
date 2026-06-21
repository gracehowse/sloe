import { useCallback, useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import type { ParsedTimer } from "@suppr/nutrition-core/recipeTimers";
import {
  cancelRunningTimer,
  createRunningTimer,
  resetRunningTimer,
  tickRunningTimers,
  type CookRunningTimer,
} from "@suppr/nutrition-core/cookRunningTimers";

export function useCookRunningTimers(recipeId: string, enabled: boolean) {
  const [runningTimers, setRunningTimers] = useState<CookRunningTimer[]>([]);
  const firedIdsRef = useRef(new Set<string>());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startParsedTimer = useCallback(
    (parsed: ParsedTimer, stepIndex: number) => {
      setRunningTimers((prev) => [...prev, createRunningTimer(parsed, stepIndex)]);
      track(AnalyticsEvents.recipe_timer_started, {
        recipeId,
        seconds: parsed.totalSeconds,
      });
    },
    [recipeId],
  );

  const cancelTimer = useCallback((id: string) => {
    setRunningTimers((prev) => cancelRunningTimer(prev, id));
    firedIdsRef.current.delete(id);
  }, []);

  const resetTimer = useCallback((id: string) => {
    firedIdsRef.current.delete(id);
    setRunningTimers((prev) => resetRunningTimer(prev, id));
  }, []);

  useEffect(() => {
    if (!enabled) {
      setRunningTimers([]);
      firedIdsRef.current.clear();
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || runningTimers.length === 0) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    if (tickRef.current) return;

    tickRef.current = setInterval(() => {
      setRunningTimers((prev) => {
        const result = tickRunningTimers(prev, Date.now(), firedIdsRef.current);
        if (!result.changed) return prev;

        for (const completed of result.newlyCompleted) {
          firedIdsRef.current.add(completed.id);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          track(AnalyticsEvents.recipe_timer_completed, {
            recipeId,
            seconds: completed.totalSeconds,
          });
        }
        return result.timers;
      });
    }, 250);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [enabled, recipeId, runningTimers.length]);

  return {
    runningTimers,
    startParsedTimer,
    cancelTimer,
    resetTimer,
  };
}
