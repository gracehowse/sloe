"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase/browserClient.ts";
import {
  buildMilestone30DayContent,
  shouldShowMilestone30Day,
  type Milestone30DayContent,
} from "../lib/nutrition/milestone30Day.ts";
import type { LoggedMeal } from "../types/recipe.ts";
import { AnalyticsEvents } from "../lib/analytics/events.ts";
import { track } from "../lib/analytics/track.ts";

export type UseMilestone30DayOnProgressInput = {
  active: boolean;
  authedUserId: string | null;
  nutritionByDay: Record<string, LoggedMeal[]>;
  weightKgByDay: Record<string, number>;
  milestone30ShownAt: string | null;
  onShownAtPersisted: (iso: string) => void;
};

/**
 * ENG-632 — 30-day milestone opens on Progress only, not Today cold-open.
 */
export function useMilestone30DayOnProgress(input: UseMilestone30DayOnProgressInput) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<Milestone30DayContent | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!input.active) return;
    if (handledRef.current) return;
    if (!input.authedUserId) return;
    if (input.milestone30ShownAt) return;
    if (Object.keys(input.nutritionByDay).length === 0) return;

    const eligible = shouldShowMilestone30Day({
      nutritionByDay: input.nutritionByDay,
      shownAt: input.milestone30ShownAt,
    });
    if (!eligible) return;

    handledRef.current = true;
    const built = buildMilestone30DayContent({
      nutritionByDay: input.nutritionByDay,
      weightKgByDay: input.weightKgByDay,
    });
    setContent(built);
    setOpen(true);

    const nowIso = new Date().toISOString();
    input.onShownAtPersisted(nowIso);
    void supabase
      .from("profiles")
      .update({ milestone_30_shown_at: nowIso } as never)
      .eq("id", input.authedUserId);

    try {
      track(AnalyticsEvents.milestone_30_shown, {
        daysLogged: built.daysLogged,
        longestStreak: built.longestStreak,
        topFoodCount: built.topFoods.length,
        platform: "web",
        surface: "progress",
      });
    } catch {
      /* noop */
    }
  }, [
    input.active,
    input.authedUserId,
    input.nutritionByDay,
    input.weightKgByDay,
    input.milestone30ShownAt,
    input.onShownAtPersisted,
  ]);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      track(AnalyticsEvents.milestone_30_dismissed, {
        platform: "web",
        surface: "progress",
      });
    } catch {
      /* noop */
    }
  }, []);

  return { open, content, dismiss, setOpen };
}
