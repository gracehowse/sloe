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
 * Activation hook (audit 2026-04-30 — leak fix #5).
 *
 * Compute the one-line subtitle shown beneath the suggestion title in
 * the north-star card. The card already shows a band chip ("Close
 * fit", "Hits within 3%") + a macros caption — but neither says WHICH
 * macro the suggestion fits. Without that context the chip reads as
 * black-box ("close to what?"), which the audit flagged as the #5
 * activation leak.
 *
 * Strategy: pick the strongest one of three reasons, in order of
 * trust signal:
 *   1. "Hits both your protein + calorie target" — when the
 *      suggestion lands ≤15% off remaining calories AND fills ≥80%
 *      of the remaining protein gap (with a positive gap).
 *   2. "Fits your remaining N g protein" — when the protein gap is
 *      meaningful (>= 10g) and the suggestion delivers ≥80% of it.
 *   3. "Fits your remaining N kcal" — fallback. Always available
 *      because the scorer only returns suggestions with positive
 *      remaining calories.
 *
 * If the algorithm has multiple why-lines per ranking factor, this
 * helper picks the strongest 1 — never lists all (per the spec).
 *
 * Pure function — no I/O, no side effects.
 */
export function whyLineForSuggestion(
  suggestion: NorthStarSuggestion,
  remaining: NorthStarRemaining,
): string {
  if (!Number.isFinite(remaining.calories) || remaining.calories <= 0) {
    // Defensive — caller should have already short-circuited via
    // `pickNorthStarSuggestion` returning null on this case. Fall
    // back to a generic line rather than throw.
    return "Fits your remaining macros";
  }

  const calRemaining = Math.round(remaining.calories);
  const protRemaining = Math.round(remaining.protein);
  const calDeltaPct =
    Math.abs(suggestion.calorieDelta) / Math.max(1, remaining.calories);

  // Protein direction — only meaningful when the user is still under
  // their protein target. The scorer rewards protein toward-target;
  // we only count it as a why if the gap was non-trivial AND the
  // suggestion fills most of it.
  const proteinGap = remaining.protein - suggestion.predictedProtein;
  const filledProteinFraction =
    remaining.protein > 0
      ? Math.min(1, suggestion.predictedProtein / remaining.protein)
      : 0;
  const proteinFits =
    remaining.protein >= 10 &&
    filledProteinFraction >= 0.8 &&
    proteinGap >= -remaining.protein * 0.2; // not wildly over

  const calorieFits = calDeltaPct <= 0.15;

  if (proteinFits && calorieFits) {
    return "Hits both your protein + calorie target";
  }
  if (proteinFits) {
    // Word "remaining" with the actual gram count the user has left.
    return `Fits your remaining ${protRemaining}g protein`;
  }
  return `Fits your remaining ${calRemaining} kcal`;
}

/**
 * Library threshold for rendering the north-star block. Per V-6
 * sub-decision (D-2026-04-27-04), default ships at ≥5; the value is
 * exported so a future flag can rebind it without re-deploying the
 * UI.
 */
export const NORTH_STAR_LIBRARY_MIN = 5 as const;

/**
 * Activation-window threshold (audit 2026-04-30 — round-2 leak fix #5).
 *
 * For the first 30 days after account creation we drop the library
 * threshold from 5 → 2 so a new user who only saved 2-3 recipes in
 * onboarding (or whose seeds didn't fully resolve) still sees a real
 * suggestion. The steady-state ≥5 threshold is the right floor for
 * the long tail of users — but it's brutal at activation, where the
 * whole point of the block is to show the new user the value of the
 * library. After 30 days, threshold reverts to the canonical 5.
 *
 * Cross-platform: same value used by web + mobile call sites.
 */
export const NORTH_STAR_LIBRARY_MIN_ACTIVATION = 2 as const;

/** Activation window in days (account < ACTIVATION_WINDOW_DAYS old → relaxed threshold). */
export const NORTH_STAR_ACTIVATION_WINDOW_DAYS = 30 as const;

/**
 * Whether the account is inside the activation window (first
 * `NORTH_STAR_ACTIVATION_WINDOW_DAYS` days after creation).
 *
 * Returns `true` when:
 *   - `userCreatedAt` is null/undefined (defensive — treat unknown
 *     creation date as a new user safety net so we don't accidentally
 *     gate the relaxed threshold off via missing data)
 *   - the supplied date is unparseable (same safety net)
 *   - the parsed date is < `NORTH_STAR_ACTIVATION_WINDOW_DAYS` ago
 *     relative to `now`
 *
 * Returns `false` when the account is ≥ window days old.
 *
 * Pure helper — caller passes `now` (or omits to use `Date.now`) so
 * tests are deterministic.
 */
export function isWithinNorthStarActivationWindow(
  userCreatedAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (userCreatedAt == null) return true;
  const created =
    userCreatedAt instanceof Date ? userCreatedAt : new Date(userCreatedAt);
  const ms = created.getTime();
  if (!Number.isFinite(ms)) return true;
  const diffMs = now.getTime() - ms;
  // Future creation date (clock drift / wrong tz) — treat as new user.
  if (diffMs < 0) return true;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays < NORTH_STAR_ACTIVATION_WINDOW_DAYS;
}

/**
 * Whether the block should render at all given the library size.
 * Below the threshold the block surfaces its "Pick a few recipes"
 * invitation state; at or above it surfaces a real suggestion.
 *
 * `userCreatedAt` (audit 2026-04-30) — when supplied and the account
 * is inside the activation window (first 30 days), the threshold is
 * relaxed to `NORTH_STAR_LIBRARY_MIN_ACTIVATION` (2). After 30 days,
 * it reverts to the canonical `NORTH_STAR_LIBRARY_MIN` (5). When the
 * date is null/undefined, the relaxed threshold applies as a safety
 * net so a brand-new user with no resolved profile date still gets
 * the activation experience. Callers should pass
 * `session.user.created_at` when available.
 */
export function isLibraryEligibleForNorthStar(
  librarySize: number,
  userCreatedAt?: Date | string | null,
  now?: Date,
): boolean {
  if (!Number.isFinite(librarySize)) return false;
  const threshold = isWithinNorthStarActivationWindow(userCreatedAt, now)
    ? NORTH_STAR_LIBRARY_MIN_ACTIVATION
    : NORTH_STAR_LIBRARY_MIN;
  return librarySize >= threshold;
}
