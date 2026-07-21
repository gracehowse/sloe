import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PushScreenHeader } from "@/components/PushScreenHeader";
import { CoachScreenView } from "@/components/coach/CoachScreenView";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled, track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { authedFetch } from "@/lib/authedFetch";
import { getSupprApiBase } from "@/lib/supprWeb";
import { supabase } from "@/lib/supabase";
import { useSavedLibraryRecipes } from "@/lib/recipes";
import useCoach from "@/lib/useCoach";
import { dateKeyFromDate } from "@suppr/nutrition-core/trackerStats";
import { detectSlotForHour } from "@suppr/nutrition-core/northStarSuggestion";
import {
  buildCoachDayFacts,
  buildTemplateCoachDayNarrative,
} from "@suppr/nutrition-core/coachDayNarrative";
import {
  buildCoachAskFacts,
  buildTemplateCoachAskAnswer,
  type CoachAskChipId,
} from "@suppr/nutrition-core/coachAsk";
import { todayLongDateSubline } from "@suppr/shared/copy/today";
import { nextUnloggedMealSlot } from "@suppr/shared/copy/today";
import { normaliseMealSlot } from "@suppr/nutrition-core/mealSlots";
import { fallbackSlotFromTimeOfDay } from "@suppr/nutrition-core/recipeJournalSlot";
import { snapshotDailyTargetIfMissing } from "@suppr/nutrition-core/dailyTargetSnapshot";
import { buildNutritionEntryRow } from "@/lib/nutritionEntryRow";
import {
  newMealId,
  normalizeJournalSlotName,
  type JournalMeal,
} from "@/lib/nutritionJournal";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";

type TodayMeal = {
  name?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
};

export default function CoachScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const enabled = isFeatureEnabled("coach_screen_v1");

  const today = useMemo(() => new Date(), []);
  const todayKey = dateKeyFromDate(today);

  const [loading, setLoading] = useState(true);
  const [mealsToday, setMealsToday] = useState<TodayMeal[]>([]);
  const [targets, setTargets] = useState({
    calories: NUTRITION_DEFAULTS.calories,
    protein: NUTRITION_DEFAULTS.protein,
    carbs: NUTRITION_DEFAULTS.carbs,
    fat: NUTRITION_DEFAULTS.fat,
  });

  const { recipes: savedLibraryRecipes } = useSavedLibraryRecipes(userId);
  const library = useMemo(
    () =>
      savedLibraryRecipes.map((r) => ({
        id: r.id,
        title: r.title,
        calories: r.calories ?? 0,
        protein: r.protein ?? 0,
        carbs: r.carbs ?? 0,
        fat: r.fat ?? 0,
        thumbnail: r.image,
        mealType: r.mealSlots,
        cookTimeMin: r.cookTimeMin ?? undefined,
      })),
    [savedLibraryRecipes],
  );

  useEffect(() => {
    if (!enabled) {
      router.replace("/(tabs)");
      return;
    }
    track(AnalyticsEvents.coach_screen_opened, { platform: "mobile" });
  }, [enabled, router]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("target_calories, target_protein, target_carbs, target_fat")
          .eq("id", userId)
          .maybeSingle();

        if (!cancelled) {
          setTargets({
            calories: Number(profile?.target_calories) || NUTRITION_DEFAULTS.calories,
            protein: Number(profile?.target_protein) || NUTRITION_DEFAULTS.protein,
            carbs: Number(profile?.target_carbs) || NUTRITION_DEFAULTS.carbs,
            fat: Number(profile?.target_fat) || NUTRITION_DEFAULTS.fat,
          });
        }

        const { data: entries } = await supabase
          .from("nutrition_entries")
          .select("name, calories, protein, carbs, fat")
          .eq("user_id", userId)
          .eq("date_key", todayKey);

        if (!cancelled) {
          setMealsToday(
            (entries ?? []).map((e) => ({
              name: e.name,
              calories: e.calories,
              protein: e.protein,
              carbs: e.carbs,
              fat: e.fat,
            })),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, todayKey]);

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

  // ENG-1603 — matches web's remaining computation
  // (src/app/components/suppr/coach-screen-client.tsx) exactly: a plain
  // target-minus-logged subtraction, no floor at 0. Clamping here would
  // re-diverge from web whenever a macro is logged past its target — the
  // shared northStarSuggestion/coach scorer needs the SAME signed
  // remaining-macro numbers on both platforms to rank suggestions
  // identically for the same user/state.
  const remaining = useMemo(
    () => ({
      calories: targets.calories - totals.calories,
      protein: targets.protein - totals.protein,
      carbs: targets.carbs - totals.carbs,
      fat: targets.fat - totals.fat,
      dailyCalorieTarget: targets.calories,
    }),
    [targets, totals],
  );

  const loggedSlots = mealsToday.map((m) => normalizeJournalSlotName(m.name ?? ""));
  const nextMeal = nextUnloggedMealSlot(loggedSlots);
  const slot = detectSlotForHour(today.getHours() * 60 + today.getMinutes());

  const dayFactsInput = useMemo(
    () => ({
      dateLabel: todayLongDateSubline(today),
      caloriesLogged: totals.calories,
      calorieTarget: targets.calories,
      proteinLogged: totals.protein,
      proteinTarget: targets.protein,
      mealsLoggedCount: mealsToday.length,
      nextMealSlot: nextMeal,
    }),
    [today, totals, targets, mealsToday.length, nextMeal],
  );

  const templateNarrative = useMemo(
    () => buildTemplateCoachDayNarrative(buildCoachDayFacts(dayFactsInput)),
    [dayFactsInput],
  );

  const [narrative, setNarrative] = useState(templateNarrative);
  const [narrativeLoading, setNarrativeLoading] = useState(true);
  const [selectedChipId, setSelectedChipId] = useState<CoachAskChipId | null>(null);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);

  const { candidates, source, refining } = useCoach({
    library,
    remaining,
    slot,
    enabled,
  });

  // ENG-1288 — meal_coach_suggestion_shown: fires once per screen-view
  // when the suggestion list renders, with the FINAL source attribution.
  // A 2+ candidate set triggers the AI re-rank fetch on mount, so we wait
  // for `refining` to settle before firing — a mount-instant emit would
  // always report "deterministic" and hide the AI hit-rate. A 0/1-candidate
  // set never fetches (useCoach contract) and fires immediately. Gated on
  // `!loading` so it only fires once the CoachScreenView is on screen.
  // Web parity: src/app/components/suppr/coach-screen-client.tsx.
  const suggestionShownRef = useRef(false);
  const sawRefiningRef = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    if (refining) {
      sawRefiningRef.current = true;
      return;
    }
    if (loading || suggestionShownRef.current || candidates.length === 0) return;
    if (candidates.length >= 2 && !sawRefiningRef.current) return;
    suggestionShownRef.current = true;
    track(AnalyticsEvents.meal_coach_suggestion_shown, {
      source,
      candidateCount: candidates.length,
      slot,
      platform: "mobile",
    });
  }, [enabled, loading, refining, candidates, source, slot]);

  useEffect(() => {
    if (!enabled || !userId) return;
    let cancelled = false;
    setNarrativeLoading(true);
    void authedFetch(`${getSupprApiBase()}/api/nutrition/coach-day-narrative`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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
  }, [dayFactsInput, enabled, userId]);

  const onAskChip = useCallback(
    async (chipId: CoachAskChipId) => {
      setSelectedChipId(chipId);
      setAskLoading(true);
      setAskAnswer(null);
      track(AnalyticsEvents.coach_ask_chip_tapped, { chip_id: chipId, platform: "mobile" });

      const top = candidates[0];
      const body = {
        chipId,
        ...dayFactsInput,
        topCandidateTitle: top?.title ?? null,
        topCandidateCalories: top?.predictedCalories ?? null,
        topCandidateProtein: top?.predictedProtein ?? null,
      };

      // ENG-1288 — completion pair for coach_ask_chip_tapped. Fires on
      // every resolution path; the client-side template fallback emits
      // source:"template" so template answers are not undercounted.
      // Web parity: src/app/components/suppr/coach-screen-client.tsx.
      const emitAnswered = (source: "ai" | "template") => {
        track(AnalyticsEvents.coach_ask_answered, {
          chip_id: chipId,
          source,
          platform: "mobile",
        });
      };

      try {
        const res = await authedFetch(`${getSupprApiBase()}/api/nutrition/coach-ask`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
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

  if (!enabled) return null;

  return (
    <View
      testID="screen-coach"
      style={{ flex: 1, backgroundColor: colors.background, paddingBottom: insets.bottom }}
    >
      <PushScreenHeader title="Your coach" onBack={() => router.back()} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.tint} />
      ) : (
        <CoachScreenView
          narrative={narrative}
          narrativeLoading={narrativeLoading}
          candidates={candidates}
          candidatesRefining={refining}
          onCandidatePress={(id) => router.push(`/recipe/${id}`)}
          librarySize={library.length}
          remainingCalories={remaining.calories}
          selectedChipId={selectedChipId}
          askAnswer={askAnswer}
          askLoading={askLoading}
          onAskChip={onAskChip}
        />
      )}
    </View>
  );
}
