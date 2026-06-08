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
 * fits the calories I have left for THIS meal and pushes me toward the
 * macros I'm still under by?" — so we score one recipe at a time.
 *
 * ── ENG-995 rebuild (2026-06-08) — two correctness fixes ──────────────
 * Founder feedback: the block "makes no sense" — it suggested a double
 * portion of one recipe to fill the WHOLE day's calories. Root causes:
 *
 *   1. Portion scaling. The old scorer scaled each recipe by a
 *      {0.5, 1.0, 1.5, 2.0} multiplier and surfaced the scaled number,
 *      so a 573-kcal/serving recipe could display as 860 kcal (1.5×).
 *      That number doesn't match the recipe detail and isn't a real
 *      serving. FIX: actual servings only — `predictedCalories =
 *      recipe.calories` (one serving). No multiplier. The card now
 *      shows the recipe's true per-serving number, identical to the
 *      recipe detail.
 *
 *   2. Whole-day calorie target. The old scorer scored every recipe
 *      against the ENTIRE remaining-calorie envelope, so in the morning
 *      (a full day left) the "best fit" was whatever recipe was closest
 *      to the whole day's worth of calories — i.e. it deliberately
 *      preferred a giant meal. FIX: score against a sensible per-MEAL
 *      budget, `perMealTarget = min(slotShare[slot] · dailyCalorieTarget,
 *      remaining.calories)`. Morning with a full day left now targets
 *      ~25–35% of the day (a normal single meal); late in the day with
 *      little left, it caps at `remaining`. It never sizes one meal to
 *      the whole day.
 *
 * Scoring intuition (in order of weight):
 *   1. Calorie fit — the recipe's per-serving calories should land
 *      near `perMealTarget`. Heavily over-shooting the meal budget is
 *      worse than under-shooting (matches whole-day scorer asymmetry).
 *   2. Protein direction — pushing toward the protein remaining for the
 *      DAY is bonus (one meal legitimately contributes to the day's
 *      protein gap); going past zero protein remaining is neutral
 *      (protein can't really be "over-target" the same way calories can).
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
  /**
   * Optional cook time in minutes — surfaced on the Figma `654:2`
   * hero meta row ("· {n} min"). Additive + optional so existing
   * callers stay source-compatible; absent for recipes with no
   * recorded time.
   */
  cookTimeMin?: number | null;
}

export interface NorthStarRemaining {
  /** Calories still available today (daily target − logged). */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /**
   * The user's FULL daily calorie target (target, not remaining).
   * ENG-995: the scorer derives a per-meal budget from this
   * (`perMealTarget = min(slotShare · dailyCalorieTarget, remaining)`)
   * so it never sizes one meal to the whole remaining day. Required —
   * the caller already knows it (`remaining = dailyCalorieTarget −
   * logged`), so threading it costs nothing and the compiler forces
   * every call site to supply it (no silent fall-back to whole-day
   * scoring). Non-finite / non-positive values degrade gracefully:
   * the scorer then uses `remaining.calories` as the meal budget.
   */
  dailyCalorieTarget: number;
}

export interface NorthStarSlot {
  /** Canonical slot name. Used for filtering by mealType when set. */
  slot: "breakfast" | "lunch" | "dinner" | "snack";
}

export interface NorthStarSuggestion {
  recipe: NorthStarRecipe;
  /**
   * Portion multiplier. ENG-995: the scorer no longer scales recipes —
   * suggestions are always ONE actual serving — so this is always `1`.
   * The field is retained for source compatibility (older callers /
   * tests read it); a future cleanup can drop it once no caller does.
   */
  portionMultiplier: number;
  /**
   * Predicted calories for ONE serving — identical to
   * `recipe.calories` and to the recipe detail screen. ENG-995: no
   * portion scaling, so this is the recipe's real per-serving number.
   */
  predictedCalories: number;
  predictedProtein: number;
  predictedCarbs: number;
  predictedFat: number;
  /** Calories away from the per-meal target (signed). */
  calorieDelta: number;
  /** Adherence band — tighter is better. Computed on the per-serving
   *  fit to the per-meal target: "tight" within 5%, "close" within
   *  15%, "loose" beyond. */
  band: "tight" | "close" | "loose";
  /** Lower is better. */
  score: number;
}

/**
 * Choose the best single recipe from a library for the next meal.
 * Returns null when no recipe lands in a usable band (`loose` is
 * allowed; only when ALL candidates are wildly off do we return null).
 *
 * ENG-995: suggestions are always ONE actual serving (no portion
 * scaling), scored against a per-MEAL calorie budget
 * (`perMealTarget`), not the whole remaining day — see the module
 * header and `bestPortionForRecipe`.
 *
 * Time-of-day filter: when `slot` is provided, recipes whose
 * `mealType` excludes the slot are excluded. Untagged recipes are
 * eligible for any slot (matches existing planner behaviour). The slot
 * also picks the `slotShare` used to size the per-meal budget.
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

  // Per-meal calorie budget — the single most important fix in the
  // ENG-995 rebuild. We size the meal to a share of the day, capped at
  // whatever is actually left, so the morning suggestion is a normal
  // meal (not the whole day) and the late-night one can't exceed
  // remaining.
  const perMealTarget = computePerMealTarget(remaining, options?.slot);

  let best: NorthStarSuggestion | null = null;

  for (const recipe of eligible) {
    const candidate = bestPortionForRecipe(recipe, remaining, perMealTarget);
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

/** Figma `654:2` recipe-hero overline — "Dinner suggestion", etc. */
export function slotSuggestionEyebrow(
  slot: NorthStarSlot["slot"] | null,
): string {
  switch (slot) {
    case "breakfast":
      return "Breakfast suggestion";
    case "lunch":
      return "Lunch suggestion";
    case "snack":
      return "Snack suggestion";
    case "dinner":
      return "Dinner suggestion";
    default:
      return "Meal suggestion";
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

/**
 * Share of the daily calorie target a single meal in each slot should
 * aim for. ENG-995: these size the per-meal budget so a morning
 * suggestion targets a normal meal (~25–35% of the day), not the whole
 * remaining day. They sum to 1.05 deliberately — meals overlap day to
 * day and the cap at `remaining.calories` keeps the total honest; the
 * point is the relative split, not an exact partition.
 *
 * TUNABLE: exported so a future flag / experiment can rebind the split
 * without a code change. Defaults chosen to match a typical 3-meals +
 * snack day. When no slot is detected (late night / pre-dawn — the
 * "Log it" generic CTA case) we fall back to a share of 1.0, i.e. the
 * whole remaining day is the meal budget, because we genuinely don't
 * know which meal this is and capping at `remaining` never oversizes.
 */
export const NORTH_STAR_SLOT_SHARE: Record<NorthStarSlot["slot"], number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.35,
  snack: 0.1,
};

/** Share used when no slot is detected — the whole remaining day. */
export const NORTH_STAR_NO_SLOT_SHARE = 1.0 as const;

/**
 * Per-meal calorie budget the scorer aims a single serving at.
 *
 *   perMealTarget = min(slotShare · dailyCalorieTarget, remaining.calories)
 *
 * - `slotShare` comes from `NORTH_STAR_SLOT_SHARE` (or
 *   `NORTH_STAR_NO_SLOT_SHARE` when `slot` is absent).
 * - Capping at `remaining.calories` means late in the day, when little
 *   is left, the meal budget shrinks to whatever is actually available
 *   — it can never exceed the remaining day.
 * - Defensive: if `dailyCalorieTarget` is missing / non-finite /
 *   non-positive we fall back to `remaining.calories` as the budget,
 *   which reproduces a sane single-meal target (the caller is expected
 *   to always supply it; this just degrades gracefully).
 */
function computePerMealTarget(
  remaining: NorthStarRemaining,
  slot?: NorthStarSlot["slot"],
): number {
  const dayTarget = remaining.dailyCalorieTarget;
  if (!Number.isFinite(dayTarget) || dayTarget <= 0) {
    return remaining.calories;
  }
  const share = slot ? NORTH_STAR_SLOT_SHARE[slot] : NORTH_STAR_NO_SLOT_SHARE;
  return Math.min(share * dayTarget, remaining.calories);
}

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

/**
 * Score ONE recipe at its actual single serving (ENG-995: no portion
 * scaling) against the per-meal calorie budget.
 *
 * `perMealTarget` is `computePerMealTarget(remaining, slot)` — a share
 * of the day capped at what's left — so the calorie penalty pulls
 * toward a normal meal size, never the whole remaining day. Protein /
 * carb / fat pulls still use the DAY's remaining macros (one meal
 * legitimately closes part of the day's macro gap).
 */
function bestPortionForRecipe(
  recipe: NorthStarRecipe,
  remaining: NorthStarRemaining,
  perMealTarget: number,
): NorthStarSuggestion | null {
  if (!Number.isFinite(recipe.calories) || recipe.calories <= 0) return null;

  // One actual serving — the real per-serving numbers, identical to
  // the recipe detail screen.
  const c = recipe.calories;
  const p = recipe.protein;
  const ca = recipe.carbs;
  const f = recipe.fat;

  // Distance from the per-MEAL budget (not the whole remaining day).
  const calDelta = c - perMealTarget;

  // Calorie penalty — asymmetric (over-shooting the meal budget
  // penalised more, matches whole-day scorer behaviour).
  let penalty = 0;
  if (calDelta > 0) {
    penalty += calDelta * 3;
  } else {
    penalty += Math.abs(calDelta) * 1.5;
  }

  // Protein direction bonus — pulling toward the day's remaining
  // protein is good. We don't penalise overshoot (protein can't be
  // "over"). Unchanged from the whole-day intuition: a single meal
  // genuinely contributes to the day's protein gap.
  const protShortfall = remaining.protein - p;
  if (protShortfall > 0) {
    penalty += protShortfall * 0.5;
  }

  // Carb / fat — penalise distance from the day's remaining (mild).
  penalty += Math.abs(remaining.carbs - ca) * 0.1;
  penalty += Math.abs(remaining.fat - f) * 0.1;

  const band = bandFor(calDelta, perMealTarget);

  return {
    recipe,
    // ENG-995: always one serving.
    portionMultiplier: 1,
    predictedCalories: Math.round(c),
    predictedProtein: Math.round(p * 10) / 10,
    predictedCarbs: Math.round(ca * 10) / 10,
    predictedFat: Math.round(f * 10) / 10,
    calorieDelta: Math.round(calDelta),
    band,
    score: penalty,
  };
}

function bandFor(calDelta: number, perMealTarget: number): NorthStarSuggestion["band"] {
  if (perMealTarget <= 0) return "loose";
  const pct = Math.abs(calDelta) / perMealTarget;
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
 *      suggestion's calorie band is tight/close (within 15% of the
 *      per-meal budget) AND it fills ≥80% of the remaining protein
 *      gap (with a positive gap).
 *   2. "Fits your remaining N g protein" — when the protein gap is
 *      meaningful (>= 10g) and the suggestion delivers ≥80% of it.
 *   3. "Fits your remaining N kcal" — fallback. Always available
 *      because the scorer only returns suggestions with positive
 *      remaining calories.
 *
 * ENG-995: "calorie fits" now reads off the per-meal `band`
 * (`tight`/`close`), so the why-line and the band chip on the card
 * always agree — both describe the same per-meal fit, not a whole-day
 * fit. The kcal/protein figures still quote the DAY's remaining,
 * because that's the number the user is tracking against.
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

  // Per-meal calorie fit — the band IS the per-meal fit signal, so the
  // chip and this line never disagree. "loose" = doesn't fit the meal.
  const calorieFits = suggestion.band !== "loose";

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
