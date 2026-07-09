import { memo } from "react";
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
  slotSuggestionEyebrow,
  whyLineForSuggestion,
  type NorthStarRecipe,
} from "@suppr/nutrition-core/northStarSuggestion";
import { normaliseMealSlot } from "@suppr/nutrition-core/mealSlots";
import { fallbackSlotFromTimeOfDay } from "@suppr/nutrition-core/recipeJournalSlot";
import {
  isSingleDayUnderEating,
  overBudgetStage,
  underEatingCoachLine,
} from "@suppr/nutrition-core/coachOverBudgetStage";
import { isFeatureEnabled } from "@/lib/analytics";

import { NorthStarBlock } from "./NorthStarBlock";

/**
 * ENG-1301 — payload for the compact secondary "Log" action: the suggested
 * recipe's predicted macros as a quick-log item plus the suggested journal
 * slot, ready for the host screen's existing quick-log insert helper
 * (`logHistoryItemToSlot` on mobile / `addLoggedMealForDate` on web — no new
 * logging path).
 */
export interface NorthStarLogPayload {
  item: {
    recipeTitle: string;
    recipeId?: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    source?: string;
    count: number;
  };
  /** Canonical journal slot ("Breakfast" | "Lunch" | "Dinner" | "Snacks")
   *  derived from the suggestion's time-of-day slot. */
  slotName: string;
}

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
  /** ENG-995: the user's FULL daily calorie target (not remaining).
   *  Threaded into the scorer so the per-meal budget is a share of the
   *  day, never the whole remaining day. Mirror of the web host prop. */
  dailyCalorieTarget: number;
  /** ENG-1454 — today's raw eaten calories (unclamped — unlike
   *  `remainingCalories`, which the caller floors at 0). Needed to derive
   *  the staged over-budget coach line's magnitude once the user has
   *  crossed the target; `remainingCalories` alone can't tell "just over"
   *  from "way over" because it's clamped to 0 the moment the user is at
   *  or past target. Optional so older callers keep compiling — omitting
   *  it just means the staged copy can't resolve (falls to the legacy
   *  caption, same as flag-off). */
  consumedCalories?: number;
  /** ENG-1454 — the user's LOCAL hour (0-23), for the single-day
   *  under-eating gate's "~8pm local" threshold. Optional; omitting it
   *  just means that gate never fires (same as flag-off). */
  localHour?: number;
  /** Called when the user taps the primary CTA on the suggestion card.
   *  Receives the suggestion's recipe id so the parent can route
   *  directly to that recipe (or open the log sheet, on web). */
  onPrimaryCta: (recipeId: string) => void;
  /** ENG-1301 — compact secondary "Log": one-tap logs the suggested recipe
   *  to the suggested slot via the parent's existing quick-log insert
   *  helper. Absent → the Log action doesn't render. */
  onLogSuggestion?: (payload: NorthStarLogPayload) => Promise<void> | void;
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
  /** ENG-94 (2026-05-13): true when the user has logged at least one
   *  meal across their entire history. When false, the host renders
   *  the `new-user` kind (calm "Log your first meal" card) instead
   *  of the algorithmic suggestion — the algorithm has nothing to
   *  pattern-match on yet. */
  hasEverLoggedAnyMeal?: boolean;
}

function NorthStarBlockHostImpl({
  viewMode,
  savedRecipesForLibrary,
  remainingCalories,
  remainingProtein,
  remainingCarbs,
  remainingFat,
  dailyCalorieTarget,
  consumedCalories,
  localHour,
  onPrimaryCta,
  onLogSuggestion,
  onBrowseLibrary,
  selectedDateKey,
  userCreatedAt,
  hasEverLoggedAnyMeal,
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

  // ENG-1454 — single-day under-eating nudge (<60% of goal by ~8pm local),
  // behind `coaching_stages_v1`. Only fires when NOT over-budget (mutually
  // exclusive with the branch below) and the host has threaded both the
  // raw eaten total and the local hour. Flagged for diversity-inclusion +
  // nutrition-engine lens review before ramp — see coachOverBudgetStage.ts.
  if (
    remainingCalories > 0 &&
    consumedCalories != null &&
    localHour != null &&
    isFeatureEnabled("coaching_stages_v1") &&
    isSingleDayUnderEating(consumedCalories, dailyCalorieTarget, localHour)
  ) {
    return <NorthStarBlock kind="under-eating" underEatingLine={underEatingCoachLine("single-day")} />;
  }

  if (remainingCalories <= 0) {
    // ENG-1454 — resolve the stage when the caller has threaded the raw
    // eaten total (consumedCalories is optional for back-compat). When
    // absent, `NorthStarBlock` falls through to the legacy caption anyway.
    const stage =
      consumedCalories != null
        ? (overBudgetStage(consumedCalories, dailyCalorieTarget) ?? undefined)
        : undefined;
    return (
      <NorthStarBlock
        kind="over-budget"
        overBudgetStage={stage}
        overBudgetCalories={
          consumedCalories != null
            ? { consumed: consumedCalories, goal: dailyCalorieTarget }
            : undefined
        }
      />
    );
  }

  // ENG-94 (2026-05-13): on a true day-1 user (no historical log
  // data anywhere), render the calmer `new-user` card instead of an
  // algorithmic suggestion. The default suggestion was pattern-
  // matching on targets alone, which read as presumptuous before
  // the user had logged anything.
  if (hasEverLoggedAnyMeal === false) {
    return <NorthStarBlock kind="new-user" />;
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
        // no chip. Mirror of web NorthStarBlockHost.
        cookTimeMin: suggestion.recipe.cookTimeMin ?? undefined,
        // ENG-1417 — trust signal for the "~" unverified-estimate qualifier.
        // Mirror of web NorthStarBlockHost.
        isVerified: suggestion.recipe.isVerified,
        // Activation hook (audit 2026-04-30 — leak fix #5): expose
        // the strongest WHY (which macro the suggestion fits) so the
        // card stops reading as black-box. See `whyLineForSuggestion`.
        whyLine: whyLineForSuggestion(suggestion, remaining),
      }}
      onPrimaryCta={() => onPrimaryCta(suggestion.recipe.id)}
      // ENG-1301 — the Log payload carries the SAME predicted macros the
      // card shows, targeted at the suggested slot (falls back to the
      // time-of-day slot outside the four windows).
      onLogCta={
        onLogSuggestion
          ? () =>
              onLogSuggestion({
                item: {
                  recipeTitle: suggestion.recipe.title,
                  recipeId: suggestion.recipe.id,
                  calories: suggestion.predictedCalories,
                  protein: suggestion.predictedProtein,
                  carbs: suggestion.predictedCarbs,
                  fat: suggestion.predictedFat,
                  source: "Recipe",
                  count: 1,
                },
                slotName: normaliseMealSlot(slot) ?? fallbackSlotFromTimeOfDay(now),
              })
          : undefined
      }
      onSkip={() => handleSkip(suggestion.recipe.id)}
    />
  );
}

export const NorthStarBlockHost = memo(NorthStarBlockHostImpl);

export default NorthStarBlockHost;
