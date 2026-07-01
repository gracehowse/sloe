"use client";

/**
 * CoachScreenClient — loads Today data and drives the full Coach screen (web).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/context/AppDataContext";
import { isFeatureEnabled, track } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { todayLongDateSubline } from "@/lib/copy/today";
import { dateKeyFromDate } from "@/lib/nutrition/journalNavigation";
import { normalizeJournalSlotName } from "@/lib/nutrition/journalSlot";
import { nextUnloggedMealSlot } from "@/lib/copy/today";
import { detectSlotForHour } from "@/lib/nutrition/northStarSuggestion";
import { buildCoachDayFacts, buildTemplateCoachDayNarrative } from "@/lib/nutrition/coachDayNarrative";
import type { CoachAskChipId } from "@/lib/nutrition/coachAsk";
import { buildTemplateCoachAskAnswer, buildCoachAskFacts } from "@/lib/nutrition/coachAsk";
import { useCoach } from "@/lib/today/useCoach";
import { CoachScreen } from "./coach-screen";

export function CoachScreenClient() {
  const router = useRouter();
  const { nutritionByDay, nutritionTargets, savedRecipesForLibrary } = useAppData();
  const calorieTarget = nutritionTargets.calories;
  const macroTargets = nutritionTargets;

  const today = useMemo(() => new Date(), []);
  const todayKey = dateKeyFromDate(today);
  const mealsToday = nutritionByDay[todayKey] ?? [];

  const totals = useMemo(() => {
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    for (const m of mealsToday) {
      calories += Number(m.calories) || 0;
      protein += Number(m.protein) || 0;
      carbs += Number(m.carbs) || 0;
      fat += Number(m.fat) || 0;
    }
    return { calories, protein, carbs, fat };
  }, [mealsToday]);

  const remaining = useMemo(
    () => ({
      calories: calorieTarget - totals.calories,
      protein: macroTargets.protein - totals.protein,
      carbs: macroTargets.carbs - totals.carbs,
      fat: macroTargets.fat - totals.fat,
      dailyCalorieTarget: calorieTarget,
    }),
    [calorieTarget, macroTargets, totals],
  );

  const loggedSlots = mealsToday.map((m) => normalizeJournalSlotName(m.name ?? ""));
  const nextMeal = nextUnloggedMealSlot(loggedSlots);
  const slot = detectSlotForHour(today.getHours() * 60 + today.getMinutes());

  const dayFactsInput = useMemo(
    () => ({
      dateLabel: todayLongDateSubline(today),
      caloriesLogged: totals.calories,
      calorieTarget,
      proteinLogged: totals.protein,
      proteinTarget: macroTargets.protein,
      mealsLoggedCount: mealsToday.length,
      nextMealSlot: nextMeal,
    }),
    [
      today,
      totals,
      calorieTarget,
      macroTargets.protein,
      mealsToday.length,
      nextMeal,
    ],
  );

  const templateNarrative = useMemo(
    () => buildTemplateCoachDayNarrative(buildCoachDayFacts(dayFactsInput)),
    [dayFactsInput],
  );

  const [narrative, setNarrative] = useState(templateNarrative);
  const [narrativeLoading, setNarrativeLoading] = useState(true);

  const enabled = isFeatureEnabled("coach_screen_v1");

  const { candidates, refining } = useCoach({
    library: savedRecipesForLibrary,
    remaining,
    slot,
    enabled,
  });

  const [selectedChipId, setSelectedChipId] = useState<CoachAskChipId | null>(null);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      router.replace("/today");
      return;
    }
    track(AnalyticsEvents.coach_screen_opened, { platform: "web" });
  }, [enabled, router]);

  useEffect(() => {
    let cancelled = false;
    setNarrativeLoading(true);
    void fetch("/api/nutrition/coach-day-narrative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dayFactsInput),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { narrative?: string };
        return typeof data.narrative === "string" ? data.narrative : null;
      })
      .then((text) => {
        if (!cancelled && text) setNarrative(text);
      })
      .finally(() => {
        if (!cancelled) setNarrativeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dayFactsInput]);

  const onAskChip = useCallback(
    async (chipId: CoachAskChipId) => {
      setSelectedChipId(chipId);
      setAskLoading(true);
      setAskAnswer(null);
      track(AnalyticsEvents.coach_ask_chip_tapped, { chip_id: chipId, platform: "web" });

      const top = candidates[0];
      const askBody = {
        chipId,
        ...dayFactsInput,
        topCandidateTitle: top?.title ?? null,
        topCandidateCalories: top?.predictedCalories ?? null,
        topCandidateProtein: top?.predictedProtein ?? null,
      };

      try {
        const res = await fetch("/api/nutrition/coach-ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(askBody),
        });
        if (res.ok) {
          const data = (await res.json()) as { answer?: string };
          if (typeof data.answer === "string") {
            setAskAnswer(data.answer);
            return;
          }
        }
        const facts = buildCoachAskFacts({
          ...buildCoachDayFacts(dayFactsInput),
          chipId,
          topCandidateTitle: top?.title ?? null,
          topCandidateCalories: top?.predictedCalories ?? null,
          topCandidateProtein: top?.predictedProtein ?? null,
        });
        setAskAnswer(buildTemplateCoachAskAnswer(facts));
      } catch {
        const facts = buildCoachAskFacts({
          ...buildCoachDayFacts(dayFactsInput),
          chipId,
          topCandidateTitle: top?.title ?? null,
          topCandidateCalories: top?.predictedCalories ?? null,
          topCandidateProtein: top?.predictedProtein ?? null,
        });
        setAskAnswer(buildTemplateCoachAskAnswer(facts));
      } finally {
        setAskLoading(false);
      }
    },
    [candidates, dayFactsInput],
  );

  if (!enabled) {
    return null;
  }

  return (
    <CoachScreen
      narrative={narrative}
      narrativeLoading={narrativeLoading}
      candidates={candidates}
      candidatesRefining={refining}
      onCandidatePress={(id) => router.push(`/recipe/${id}`)}
      selectedChipId={selectedChipId}
      askAnswer={askAnswer}
      askLoading={askLoading}
      onAskChip={onAskChip}
    />
  );
}
