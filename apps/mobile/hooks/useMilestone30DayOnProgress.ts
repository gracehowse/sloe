import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  buildMilestone30DayContent,
  shouldShowMilestone30Day,
  type Milestone30DayContent,
} from "@/lib/milestone30Day";
import type { ByDay } from "@/lib/nutritionJournal";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";

const MILESTONE_LOCAL_KEY = "suppr.milestone_30.shown_at_local";

export type UseMilestone30DayOnProgressInput = {
  active: boolean;
  userId: string | null;
  byDay: ByDay;
  weightKgByDay: Record<string, number>;
  milestone30ShownAt: string | null;
  onShownAtPersisted: (iso: string) => void;
};

/** ENG-632 — 30-day milestone on Progress tab only (not Today cold-open). */
export function useMilestone30DayOnProgress(input: UseMilestone30DayOnProgressInput) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<Milestone30DayContent | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (input.milestone30ShownAt) return;
    let cancelled = false;
    void AsyncStorage.getItem(MILESTONE_LOCAL_KEY).then((raw) => {
      if (cancelled) return;
      if (typeof raw === "string" && raw) {
        input.onShownAtPersisted(raw);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [input.milestone30ShownAt, input.onShownAtPersisted]);

  useEffect(() => {
    if (!input.active) return;
    if (handledRef.current) return;
    if (!input.userId) return;
    if (input.milestone30ShownAt) return;
    if (Object.keys(input.byDay).length === 0) return;

    const eligible = shouldShowMilestone30Day({
      nutritionByDay: input.byDay as never,
      shownAt: input.milestone30ShownAt,
    });
    if (!eligible) return;

    handledRef.current = true;
    const built = buildMilestone30DayContent({
      nutritionByDay: input.byDay as never,
      weightKgByDay: input.weightKgByDay,
    });
    setContent(built);
    setOpen(true);

    const nowIso = new Date().toISOString();
    input.onShownAtPersisted(nowIso);
    void AsyncStorage.setItem(MILESTONE_LOCAL_KEY, nowIso).catch((err) => {
      console.warn("[milestone30] AsyncStorage write failed:", err);
    });
    void (async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ milestone_30_shown_at: nowIso } as never)
        .eq("id", input.userId);
      if (error) {
        console.warn("[milestone30] server stamp failed:", error.message);
      }
    })();

    try {
      track("milestone_30_shown", {
        daysLogged: built.daysLogged,
        longestStreak: built.longestStreak,
        topFoodCount: built.topFoods.length,
        platform: "ios",
        surface: "progress",
      });
    } catch {
      /* noop */
    }
  }, [
    input.active,
    input.userId,
    input.byDay,
    input.weightKgByDay,
    input.milestone30ShownAt,
    input.onShownAtPersisted,
  ]);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      track("milestone_30_dismissed", {
        platform: "ios",
        surface: "progress",
      });
    } catch {
      /* noop */
    }
  }, []);

  return { open, content, dismiss };
}
