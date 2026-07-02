"use client";

/**
 * CoachScreenClient — loads Today data and drives the full Coach screen (web).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  const { candidates, source, refining } = useCoach({
    library: savedRecipesForLibrary,
    remaining,
    slot,
    enabled,
  });

  // ENG-1288 — meal_coach_suggestion_shown: fires once per screen-view
  // when the suggestion list renders, with the FINAL source attribution.
  // A 2+ candidate set triggers the AI re-rank fetch on mount, so we wait
  // for `refining` to settle before firing — a mount-instant emit would
  // always report "deterministic" and hide the AI hit-rate. A 0/1-candidate
  // set never fetches (useCoach contract) and fires immediately.
  const suggestionShownRef = useRef(false);
  const sawRefiningRef = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    if (refining) {
      sawRefiningRef.current = true;
      return;
    }
    if (suggestionShownRef.current || candidates.length === 0) return;
    if (candidates.length >= 2 && !sawRefiningRef.current) return;
    suggestionShownRef.current = true;
    track(AnalyticsEvents.meal_coach_suggestion_shown, {
      source,
      candidateCount: candidates.length,
      slot,
      platform: "web",
    });
  }, [enabled, refining, candidates, source, slot]);

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

      // ENG-1288 — completion pair for coach_ask_chip_tapped. Fires on
      // every resolution path; the client-side template fallback emits
      // source:"template" so template answers are not undercounted.
      const emitAnswered = (source: "ai" | "template") => {
        track(AnalyticsEvents.coach_ask_answered, {
          chip_id: chipId,
          source,
          platform: "web",
        });
      };

      try {
        const res = await fetch("/api/nutrition/coach-ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(askBody),
        });
        if (res.ok) {
          const data = (await res.json()) as { answer?: string; source?: string };
          if (typeof data.answer === "string") {
            setAskAnswer(data.answer);
            emitAnswered(data.source === "ai" ? "ai" : "template");
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
        emitAnswered("template");
      } catch {
        const facts = buildCoachAskFacts({
          ...buildCoachDayFacts(dayFactsInput),
          chipId,
          topCandidateTitle: top?.title ?? null,
          topCandidateCalories: top?.predictedCalories ?? null,
          topCandidateProtein: top?.predictedProtein ?? null,
        });
        setAskAnswer(buildTemplateCoachAskAnswer(facts));
        emitAnswered("template");
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
