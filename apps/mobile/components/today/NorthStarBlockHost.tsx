/**
 * NorthStarBlockHost — mobile wrapper that runs the suggestion picker
 * and selects which `<NorthStarBlock>` kind to render.
 *
 * Production design spec — 2026-04-27 Surface A §A-northstar.
 * Authority: D-2026-04-27-04 + D-2026-04-27-14.
 *
 * Mirrors the web host at
 * `src/app/components/NutritionTracker.tsx#NorthStarBlockHost`. Same
 * branching logic; mobile uses AsyncStorage for the per-day skip
 * ledger (web uses localStorage), keyed by `selectedDateKey` so
 * yesterday's skips don't shadow today's library.
 */

import * as React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  bandLabel,
  ctaForSlot,
  detectSlotForHour,
  isLibraryEligibleForNorthStar,
  pickNorthStarSuggestion,
  whyLineForSuggestion,
  type NorthStarRecipe,
} from "../../../../src/lib/nutrition/northStarSuggestion";

import { NorthStarBlock } from "./NorthStarBlock";

const NORTH_STAR_SKIP_KEY_PREFIX = "suppr.northstar.skipped.";

async function readSkippedSet(dateKey: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(NORTH_STAR_SKIP_KEY_PREFIX + dateKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((s): s is string => typeof s === "string"));
  } catch {
    return new Set();
  }
}

async function writeSkippedSet(dateKey: string, set: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(
      NORTH_STAR_SKIP_KEY_PREFIX + dateKey,
      JSON.stringify(Array.from(set)),
    );
  } catch {
    // Quota / disabled storage — silent failure is fine; the skip
    // simply doesn't persist past the in-memory state.
  }
}

export interface NorthStarBlockHostProps {
  /** Whether the parent screen is in day or week view. Block hides on
   *  week. */
  viewMode: "day" | "week";
  savedRecipesForLibrary: readonly NorthStarRecipe[];
  remainingCalories: number;
  remainingProtein: number;
  remainingCarbs: number;
  remainingFat: number;
  /** Called when the user taps the primary CTA on the suggestion card.
   *  Receives the suggestion's recipe id so the parent can route
   *  directly to that recipe (or open the log sheet, on web). */
  onPrimaryCta: (recipeId: string) => void;
  onBrowseLibrary: () => void;
  /** Date scope for the skip ledger. Should match the host screen's
   *  selectedDateKey so the set resets daily. */
  selectedDateKey: string;
  /** Account creation timestamp (ISO string from
   *  `session.user.created_at`). When the account is < 30 days old
   *  the library threshold relaxes from ≥5 to ≥2 (audit 2026-04-30
   *  activation leak fix). Pass `undefined` only when the value is
   *  unknown — the gate treats unknown as new-user. */
  userCreatedAt?: string | null;
}

export function NorthStarBlockHost({
  viewMode,
  savedRecipesForLibrary,
  remainingCalories,
  remainingProtein,
  remainingCarbs,
  remainingFat,
  onPrimaryCta,
  onBrowseLibrary,
  selectedDateKey,
  userCreatedAt,
}: NorthStarBlockHostProps) {
  const [skippedIds, setSkippedIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let cancelled = false;
    void readSkippedSet(selectedDateKey).then((set) => {
      if (!cancelled) setSkippedIds(set);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDateKey]);

  const handleSkip = React.useCallback(
    (recipeId: string) => {
      setSkippedIds((prev) => {
        const next = new Set(prev);
        next.add(recipeId);
        void writeSkippedSet(selectedDateKey, next);
        return next;
      });
    },
    [selectedDateKey],
  );

  if (viewMode !== "day") return null;

  if (remainingCalories <= 0) {
    return <NorthStarBlock kind="over-budget" />;
  }

  if (
    !isLibraryEligibleForNorthStar(
      savedRecipesForLibrary.length,
      userCreatedAt,
    )
  ) {
    return (
      <NorthStarBlock kind="library-empty" onOpenLibrary={onBrowseLibrary} />
    );
  }

  const now = new Date();
  const slot = detectSlotForHour(now.getHours() * 60 + now.getMinutes());
  const remaining = {
    calories: remainingCalories,
    protein: remainingProtein,
    carbs: remainingCarbs,
    fat: remainingFat,
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
        // Activation hook (audit 2026-04-30 — leak fix #5): expose
        // the strongest WHY (which macro the suggestion fits) so the
        // card stops reading as black-box. See `whyLineForSuggestion`.
        whyLine: whyLineForSuggestion(suggestion, remaining),
      }}
      onPrimaryCta={() => onPrimaryCta(suggestion.recipe.id)}
      onSkip={() => handleSkip(suggestion.recipe.id)}
    />
  );
}

export default NorthStarBlockHost;
