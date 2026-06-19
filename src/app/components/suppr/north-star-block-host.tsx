import { useCallback, useEffect, useState } from "react";

import { NorthStarBlock } from "./north-star-block";
import {
  pickNorthStarSuggestion,
  detectSlotForHour,
  ctaForSlot,
  bandLabel,
  slotSuggestionEyebrow,
  whyLineForSuggestion,
  isLibraryEligibleForNorthStar,
  type NorthStarRecipe,
} from "../../../lib/nutrition/northStarSuggestion";
import {
  readNorthStarSkippedSet,
  writeNorthStarSkippedSet,
} from "../../../lib/nutrition/trackerLocalState.ts";

/**
 * NorthStarBlockHost — small wrapper that runs the suggestion picker and
 * selects which `<NorthStarBlock>` kind to render based on the library size,
 * remaining macros, and time-of-day slot.
 *
 * Authority: D-2026-04-27-04. Spec §A-northstar. Extracted from
 * `NutritionTracker.tsx` (ENG-621); it's a thin glue layer — everything
 * testable lives in `northStarSuggestion.ts` and `<NorthStarBlock>`.
 */
export function NorthStarBlockHost({
  viewMode,
  savedRecipesForLibrary,
  remainingCalories,
  remainingProtein,
  remainingCarbs,
  remainingFat,
  dailyCalorieTarget,
  onPrimaryCta,
  onBrowseLibrary,
  selectedDateKey,
  userCreatedAt,
  hasEverLoggedAnyMeal,
}: {
  viewMode: string;
  savedRecipesForLibrary: NorthStarRecipe[];
  remainingCalories: number;
  remainingProtein: number;
  remainingCarbs: number;
  remainingFat: number;
  /** ENG-995: the user's FULL daily calorie target (not remaining).
   *  Threaded into the scorer so the per-meal budget is a share of the
   *  day, never the whole remaining day. */
  dailyCalorieTarget: number;
  /** Called when the user taps the primary CTA on the suggestion card.
   *  Receives the suggestion's recipe id so the parent can route
   *  directly (mobile) or open the log sheet (web — arg ignored). */
  onPrimaryCta: (recipeId: string) => void;
  onBrowseLibrary: () => void;
  /** Date scope for the skip ledger (Phase 4 / B3.Y). */
  selectedDateKey: string;
  /** ISO `created_at` for the auth user. Drives the activation-window
   *  threshold relax (audit 2026-04-30 round-2 leak fix #5). When the
   *  account is < 30 days old the library threshold drops from ≥5 to
   *  ≥2 so a new user with 2-3 saved recipes still sees a real
   *  suggestion, not the empty-state. */
  userCreatedAt?: string | null;
  /** ENG-94 (2026-05-13): true when the user has logged at least one
   *  meal across their entire history. When false, the host renders
   *  the `new-user` kind (calm "Log your first meal" card) instead
   *  of the algorithmic suggestion. Mirror of the mobile prop. */
  hasEverLoggedAnyMeal?: boolean;
}) {
  // Phase 4 / B3.Y — per-day skip ledger keyed by selected date.
  const [skippedIds, setSkippedIds] = useState<Set<string>>(() =>
    readNorthStarSkippedSet(selectedDateKey),
  );

  // Reset the in-memory set when the day changes (and rehydrate from
  // localStorage so skips persist across reloads on the same day).
  useEffect(() => {
    setSkippedIds(readNorthStarSkippedSet(selectedDateKey));
  }, [selectedDateKey]);

  const handleSkip = useCallback(
    (recipeId: string) => {
      setSkippedIds((prev) => {
        const next = new Set(prev);
        next.add(recipeId);
        writeNorthStarSkippedSet(selectedDateKey, next);
        return next;
      });
    },
    [selectedDateKey],
  );

  if (viewMode !== "day") return null;

  // Over-budget — hide block, show calm caption.
  if (remainingCalories <= 0) {
    return <NorthStarBlock kind="over-budget" />;
  }

  // ENG-94 (2026-05-13): true day-1 user — no log history yet.
  // Render the calmer `new-user` card instead of an algorithmic
  // suggestion the algorithm has nothing to base on.
  if (hasEverLoggedAnyMeal === false) {
    return <NorthStarBlock kind="new-user" />;
  }

  // Library too small — invite the user to seed it.
  // Audit 2026-04-30 leak fix #5: threshold relaxes to ≥2 inside the
  // 30-day activation window (drops back to ≥5 once the account
  // matures). `userCreatedAt` is sourced from the auth session.
  if (
    !isLibraryEligibleForNorthStar(
      savedRecipesForLibrary.length,
      userCreatedAt,
    )
  ) {
    return <NorthStarBlock kind="library-empty" onOpenLibrary={onBrowseLibrary} />;
  }

  const now = new Date();
  const slot = detectSlotForHour(now.getHours() * 60 + now.getMinutes());
  const remaining = {
    calories: remainingCalories,
    protein: remainingProtein,
    carbs: remainingCarbs,
    fat: remainingFat,
    // ENG-995: full daily target drives the per-meal budget.
    dailyCalorieTarget,
  };

  const suggestion = pickNorthStarSuggestion(savedRecipesForLibrary, remaining, {
    slot: slot ?? undefined,
    excludeIds: skippedIds,
  });

  if (!suggestion) {
    return <NorthStarBlock kind="no-fit" onBrowse={onBrowseLibrary} />;
  }

  return (
    <NorthStarBlock
      kind="default"
      ctaLabel={ctaForSlot(slot)}
      slotEyebrow={slotSuggestionEyebrow(slot)}
      suggestion={{
        recipeId: suggestion.recipe.id,
        title: suggestion.recipe.title,
        thumbnail: suggestion.recipe.thumbnail,
        predictedCalories: suggestion.predictedCalories,
        predictedProtein: suggestion.predictedProtein,
        predictedCarbs: suggestion.predictedCarbs,
        predictedFat: suggestion.predictedFat,
        bandLabel: bandLabel(suggestion.band),
        bandTight: suggestion.band === "tight",
        // Figma `654:2` hero meta — optional cook-time chip. Source
        // from whatever the recipe exposes; `null`/absent degrades to
        // no chip. Mirror of mobile NorthStarBlockHost.
        cookTimeMin: suggestion.recipe.cookTimeMin ?? undefined,
        // Activation hook (audit 2026-04-30 — leak fix #5): expose
        // the strongest WHY (which macro the suggestion fits) so the
        // card stops reading as black-box. Mirror of mobile
        // NorthStarBlockHost. See `whyLineForSuggestion`.
        whyLine: whyLineForSuggestion(suggestion, remaining),
      }}
      onPrimaryCta={() => onPrimaryCta(suggestion.recipe.id)}
      onSkip={() => handleSkip(suggestion.recipe.id)}
    />
  );
}
