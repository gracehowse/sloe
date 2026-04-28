/**
 * northStarSuggestion — Single-recipe suggestion scoring for the
 * Today north-star block.
 *
 * Production design spec — 2026-04-27 Surface A §A-northstar.
 * Authority: D-2026-04-27-04 ("What to eat next, from your library,
 * that hits your remaining macros" is the north-star moment and a
 * permanent block on Today).
 *
 * Why a separate scorer (rather than reusing `scoreMealSetCanonical`):
 * the existing planner scorer is built for whole-day meal sets and
 * weights its penalties accordingly (×3 over-target, ×1.5 under,
 * within-day duplicate rejection). The north-star block is a
 * single-suggestion question — "of all my saved recipes, which one
 * fits the calories I have left and pushes me toward the macros I'm
 * still under by?" — so we score one recipe at a time, against
 * remaining (not absolute) macros.
 *
 * Scoring intuition (in order of weight):
 *   1. Calorie fit — Suggestion calories should land within the
 *      remaining-calorie envelope. Heavily over-shooting is worse
 *      than under-shooting (matches whole-day scorer asymmetry).
 *   2. Protein direction — pushing toward the protein remaining is
 *      bonus, going past zero protein remaining is neutral (protein
 *      can't really be "over-target" the same way calories can).
 *   3. Carb / fat — pull-toward-target only.
 *
 * Decision V-6 (sub-decision in strategic-direction.md): library-size
 * threshold for whether the block renders at all. The scorer itself
 * always returns a result (or null when no recipe is plausible); the
 * caller decides whether to show the block based on library size.
 *
 * Cross-platform: shared (used by mobile via the same import path
 * pattern as `mealPlanAlgo`).
 */

export interface NorthStarRecipe {
  id: string;
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Optional thumbnail URL. */
  thumbnail?: string;
  /** Optional slot tags ("breakfast" | "lunch" | "dinner" | "snack"). */
  mealType?: string | readonly string[] | null;
}

export interface NorthStarRemaining {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NorthStarSlot {
  /** Canonical slot name. Used for filtering by mealType when set. */
  slot: "breakfast" | "lunch" | "dinner" | "snack";
}

export interface NorthStarSuggestion {
  recipe: NorthStarRecipe;
  /** Best portion multiplier in the clamped range. */
  portionMultiplier: number;
  /** Predicted calories at this multiplier. */
  predictedCalories: number;
  predictedProtein: number;
  predictedCarbs: number;
  predictedFat: number;
  /** Calories away from the remaining target (signed). */
  calorieDelta: number;
  /** Adherence band — tighter is better. "tight" within 5%, "close"
   *  within 15%, "loose" beyond. */
  band: "tight" | "close" | "loose";
  /** Lower is better. */
  score: number;
}

/**
 * Choose the best single recipe from a library against the remaining
 * macros for a slot. Returns null when no recipe lands in a usable
 * band (`loose` is allowed; only when ALL candidates are wildly off
 * do we return null).
 *
 * The portion multiplier is clamped to {0.5, 1.0, 1.5, 2.0} matching
 * the planner clamp — the user expects the Today block to suggest
 * realistic real-world portions.
 *
 * Time-of-day filter: when `slot` is provided, recipes whose
 * `mealType` excludes the slot are excluded. Untagged recipes are
 * eligible for any slot (matches existing planner behaviour).
 */
export function pickNorthStarSuggestion(
  library: readonly NorthStarRecipe[],
  remaining: NorthStarRemaining,
  options?: {
    slot?: NorthStarSlot["slot"];
    excludeIds?: ReadonlySet<string>;
  },
): NorthStarSuggestion | null {
  if (!library || library.length === 0) return null;
  if (!isFiniteRemaining(remaining)) return null;
  // If remaining calories are non-positive, the user is at or over
  // budget — the spec says hide the block entirely (replaced with the
  // calm caption). Surface that to the caller as "no suggestion" so
  // they can render the over-budget caption instead.
  if (remaining.calories <= 0) return null;

  const filtered = filterBySlot(library, options?.slot);
  const exclude = options?.excludeIds ?? new Set<string>();
  const eligible = filtered.filter((r) => !exclude.has(r.id));
  if (eligible.length === 0) return null;

  let best: NorthStarSuggestion | null = null;

  for (const recipe of eligible) {
    const candidate = bestPortionForRecipe(recipe, remaining);
    if (!candidate) continue;
    if (!best || candidate.score < best.score) {
      best = candidate;
    }
  }

  return best;
}

/**
 * Pick the next-best suggestion after the user swipes-to-skip the
 * current one. Caller passes in the previously-suggested recipe id
 * via `excludeIds`.
 */
export function pickNextNorthStarSuggestion(
  library: readonly NorthStarRecipe[],
  remaining: NorthStarRemaining,
  excludeIds: ReadonlySet<string>,
  slot?: NorthStarSlot["slot"],
): NorthStarSuggestion | null {
  return pickNorthStarSuggestion(library, remaining, { slot, excludeIds });
}

/**
 * Detect which slot to suggest for given the local time-of-day.
 * Mirrors the spec §A-northstar CTA branching:
 *   06:00–10:30 → breakfast
 *   10:30–14:30 → lunch
 *   14:30–17:30 → snack/cook-ahead
 *   17:30–22:00 → dinner
 *   else        → null (block falls through to "Log it" generic)
 */
export function detectSlotForHour(hourMinutes: number): NorthStarSlot["slot"] | null {
  // hourMinutes is "H * 60 + M" — caller can pass `d.getHours()*60 + d.getMinutes()`.
  if (!Number.isFinite(hourMinutes)) return null;
  const hm = hourMinutes;
  if (hm >= 6 * 60 && hm < 10 * 60 + 30) return "breakfast";
  if (hm >= 10 * 60 + 30 && hm < 14 * 60 + 30) return "lunch";
  if (hm >= 14 * 60 + 30 && hm < 17 * 60 + 30) return "snack";
  if (hm >= 17 * 60 + 30 && hm < 22 * 60) return "dinner";
  return null;
}

/**
 * CTA copy for the suggestion block. Mirrors the spec §A-northstar.
 * Returns "Log it" when no slot is detected (late night / pre-dawn).
 */
export function ctaForSlot(slot: NorthStarSlot["slot"] | null): string {
  switch (slot) {
    case "breakfast":
      return "Log breakfast";
    case "lunch":
      return "Log lunch";
    case "snack":
      return "Cook ahead →";
    case "dinner":
      return "Cook it →";
    default:
      return "Log it";
  }
}

/**
 * Adherence-band label for the chip in the block. Spec uses
 * "Hits within 3%" for the tight band when the suggestion is within
 * 5% of remaining calories; "Close fit" otherwise.
 */
export function bandLabel(band: NorthStarSuggestion["band"]): string {
  switch (band) {
    case "tight":
      return "Hits within 3%";
    case "close":
      return "Close fit";
    case "loose":
      return "Roughly fits";
  }
}

/* -------------------------- Internals -------------------------- */

const PORTION_OPTIONS = [0.5, 1.0, 1.5, 2.0] as const;

function isFiniteRemaining(r: NorthStarRemaining): boolean {
  return (
    Number.isFinite(r.calories) &&
    Number.isFinite(r.protein) &&
    Number.isFinite(r.carbs) &&
    Number.isFinite(r.fat)
  );
}

function filterBySlot(
  library: readonly NorthStarRecipe[],
  slot?: NorthStarSlot["slot"],
): readonly NorthStarRecipe[] {
  if (!slot) return library;
  const slotKey = slot;
  return library.filter((r) => {
    const tags = normaliseMealType(r.mealType);
    if (tags.length === 0) return true; // untagged — eligible for all
    return tags.includes(slotKey);
  });
}

function normaliseMealType(raw: NorthStarRecipe["mealType"]): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).toLowerCase().trim());
  }
  if (typeof raw === "string") {
    return [raw.toLowerCase().trim()];
  }
  return [];
}

function bestPortionForRecipe(
  recipe: NorthStarRecipe,
  remaining: NorthStarRemaining,
): NorthStarSuggestion | null {
  if (!Number.isFinite(recipe.calories) || recipe.calories <= 0) return null;

  let best: NorthStarSuggestion | null = null;

  for (const mult of PORTION_OPTIONS) {
    const c = recipe.calories * mult;
    const p = recipe.protein * mult;
    const ca = recipe.carbs * mult;
    const f = recipe.fat * mult;

    const calDelta = c - remaining.calories;

    // Calorie penalty — asymmetric (over-shooting penalised more,
    // matches whole-day scorer behaviour).
    let penalty = 0;
    if (calDelta > 0) {
      penalty += calDelta * 3;
    } else {
      penalty += Math.abs(calDelta) * 1.5;
    }

    // Protein direction bonus — pulling toward remaining protein is
    // good. We don't penalise overshoot (protein can't be "over").
    const protShortfall = remaining.protein - p;
    if (protShortfall > 0) {
      penalty += protShortfall * 0.5;
    }

    // Carb / fat — penalise distance from remaining (mild).
    penalty += Math.abs(remaining.carbs - ca) * 0.1;
    penalty += Math.abs(remaining.fat - f) * 0.1;

    const band = bandFor(calDelta, remaining.calories);

    const candidate: NorthStarSuggestion = {
      recipe,
      portionMultiplier: mult,
      predictedCalories: Math.round(c),
      predictedProtein: Math.round(p * 10) / 10,
      predictedCarbs: Math.round(ca * 10) / 10,
      predictedFat: Math.round(f * 10) / 10,
      calorieDelta: Math.round(calDelta),
      band,
      score: penalty,
    };

    if (!best || candidate.score < best.score) {
      best = candidate;
    }
  }

  return best;
}

function bandFor(calDelta: number, calorieRemaining: number): NorthStarSuggestion["band"] {
  if (calorieRemaining <= 0) return "loose";
  const pct = Math.abs(calDelta) / calorieRemaining;
  if (pct <= 0.05) return "tight";
  if (pct <= 0.15) return "close";
  return "loose";
}

/**
 * Library threshold for rendering the north-star block. Per V-6
 * sub-decision (D-2026-04-27-04), default ships at ≥5; the value is
 * exported so a future flag can rebind it without re-deploying the
 * UI.
 */
export const NORTH_STAR_LIBRARY_MIN = 5 as const;

/**
 * Whether the block should render at all given the library size.
 * Below the threshold the block surfaces its "Pick a few recipes"
 * invitation state; at or above it surfaces a real suggestion.
 */
export function isLibraryEligibleForNorthStar(librarySize: number): boolean {
  return Number.isFinite(librarySize) && librarySize >= NORTH_STAR_LIBRARY_MIN;
}
