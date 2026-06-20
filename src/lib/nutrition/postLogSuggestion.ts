/**
 * postLogSuggestion — the calm post-log "what to eat next" micro-moment
 * (ENG-977).
 *
 * The instant an AI log (photo / voice / describe) commits, the user's
 * remaining budget just changed — the highest-intent moment to answer
 * Suppr's signature question, "what to eat next". Cal AI logs and stops
 * (no coaching layer); this bridges log → suggestion and turns a
 * transactional commit into the differentiated coaching loop.
 *
 * It builds ONE quiet line, e.g.:
 *
 *   "Logged. ~640 kcal left — dinner could be Chicken traybake."
 *
 * and reuses the north-star scorer (`pickNorthStarSuggestion`) — the same
 * engine behind the permanent Today block — so the suggestion never drifts
 * from the block. The line is permission-framed ("you have room for"),
 * never restrictive, and keeps the trust posture (kcal is estimated, hence
 * the "~"). When there is no eligible recipe to suggest it degrades to the
 * calm remaining-budget line; when the user is at or over budget it returns
 * null so the caller keeps its plain commit confirmation (the
 * "what-to-eat-next" framing only makes sense when there's room left).
 *
 * Pure function — no I/O, no side effects. Cross-platform: surfaced as a
 * toast on web (`PhotoLogDialog` / `VoiceLogDialog` host) and mobile
 * (`PhotoLogSheet` / `VoiceLogSheet` host). Gated behind the
 * `post_log_what_next_v1` flag at both call sites.
 */

import {
  detectSlotForHour,
  isLibraryEligibleForNorthStar,
  pickNorthStarSuggestion,
  type NorthStarRecipe,
  type NorthStarSlot,
} from "./northStarSuggestion";

/** The AI logging surface that committed the meal. */
export type PostLogSource = "photo" | "voice" | "describe";

export interface PostLogSuggestionInput {
  /** Saved-recipe library — the same list that feeds the Today block. */
  library: readonly NorthStarRecipe[];
  /** Remaining macros AFTER the just-committed log. */
  remaining: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  /** Full daily calorie target (sizes the per-meal budget the scorer uses). */
  dailyCalorieTarget: number;
  /** Which AI surface committed — recorded for the analytics payload. */
  source: PostLogSource;
  /** Local time used to pick the slot (defaults to now). */
  now?: Date;
  /** Account creation date — relaxes the library threshold inside the
   *  30-day activation window (matches the Today block). */
  userCreatedAt?: Date | string | null;
}

export interface PostLogSuggestionResult {
  /** The full calm line to surface. */
  line: string;
  /** Detected slot (drives the "{slot} could be …" phrasing), or null. */
  slot: NorthStarSlot["slot"] | null;
  /** Remaining calories quoted in the line (rounded to the nearest 10). */
  remainingCalories: number;
  /** True when a recipe suggestion is included in the line. */
  hasSuggestion: boolean;
  /** Suggested recipe id — for CTA wiring. Null when no suggestion. */
  recipeId: string | null;
  /** Suggested recipe title. Null when no suggestion. */
  recipeTitle: string | null;
  /** Echo of the committing surface (for the analytics payload). */
  source: PostLogSource;
}

/** Lead-in for the "{lead} could be {recipe}" clause, by slot. */
function slotLead(slot: NorthStarSlot["slot"] | null): string {
  switch (slot) {
    case "breakfast":
      return "breakfast";
    case "lunch":
      return "lunch";
    case "dinner":
      return "dinner";
    case "snack":
      return "a snack";
    case null:
      return "your next meal";
    default: {
      const _exhaustive: never = slot;
      return _exhaustive;
    }
  }
}

/**
 * Build the calm post-log "what to eat next" line, or null when the moment
 * shouldn't fire (over/at budget, or non-finite remaining).
 */
export function buildPostLogSuggestion(
  input: PostLogSuggestionInput,
): PostLogSuggestionResult | null {
  const { library, remaining, dailyCalorieTarget, source } = input;
  const now = input.now ?? new Date();

  if (!Number.isFinite(remaining.calories)) return null;
  // At or over budget — the "what to eat next" framing doesn't apply (there's
  // no room to fill). Caller keeps its plain commit confirmation.
  if (remaining.calories <= 0) return null;

  // "~" estimate posture — round to the nearest 10 so the line reads as an
  // approximation, not a false-precision figure.
  const remainingCalories = Math.max(
    0,
    Math.round(remaining.calories / 10) * 10,
  );

  const slot = detectSlotForHour(now.getHours() * 60 + now.getMinutes());

  const eligible = isLibraryEligibleForNorthStar(
    library.length,
    input.userCreatedAt,
    now,
  );
  const suggestion = eligible
    ? pickNorthStarSuggestion(
        library,
        {
          calories: remaining.calories,
          protein: remaining.protein,
          carbs: remaining.carbs,
          fat: remaining.fat,
          dailyCalorieTarget,
        },
        slot ? { slot } : undefined,
      )
    : null;

  if (suggestion) {
    return {
      line: `Logged. ~${remainingCalories} kcal left — ${slotLead(slot)} could be ${suggestion.recipe.title}.`,
      slot,
      remainingCalories,
      hasSuggestion: true,
      recipeId: suggestion.recipe.id,
      recipeTitle: suggestion.recipe.title,
      source,
    };
  }

  return {
    line: `Logged. ~${remainingCalories} kcal left for today.`,
    slot,
    remainingCalories,
    hasSuggestion: false,
    recipeId: null,
    recipeTitle: null,
    source,
  };
}
