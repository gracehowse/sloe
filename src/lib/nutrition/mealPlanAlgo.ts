/**
 * Smart meal planning algorithm.
 * Configurable slots, macro-aware scoring, portion scaling, and day variety.
 *
 * SYNC NOTE: The web uses an identical algorithm in src/lib/planning/generateMealPlan.ts.
 * Changes to scoring, weights, or multiplier logic must be applied to both files.
 * The two files use different recipe types (SimpleRecipe vs RecipeCard) but
 * identical algorithmic logic.
 *
 * F-15 (2026-04-19, TestFlight `APO0Nk_bre`, product-lead 2026-04-19):
 * multiplier objective is now **joint** (protein-leading, then calories,
 * then carbs+fat) rather than per-slot calorie share. The day-level scaler
 * `fitDayToTargets` iterates picked recipes' multipliers within the shared
 * `PORTION_MULTIPLIER_CLAMP` and returns a `residualProteinGap` when the
 * library can't reach the protein target. Clamp parity: mobile's 0.2..2.5
 * at 0.1 step is adopted everywhere (wider range gives the scaler more
 * headroom than the old web 0.5..2.0 at 0.25 step).
 *
 * F-71 (2026-04-24, TestFlight `AGSeM-FnnYbZ` + siblings): coerce recipes whose
 * calories are mostly unexplained by P/C/F before joint-fit, and penalise
 * extreme portion spreads in the sampler score.
 *
 * F-73 (2026-04-24): joint fit seeds at 1.0× per slot (not per-slot calorie
 * share), snaps multipliers toward 1 when macro bands still hold, and adds a
 * sampler penalty for deviation from 1× so full portions win when feasible.
 */

import {
  coerceMacrosWhenCaloriesButNoGrams,
  mealPlanPortionSpreadPenalty,
} from "./coerceRecipeMacrosForPlanning";

/**
 * P0-5 (2026-04-25): hard cap on the inner-day sampler. Pre-fix this was an
 * inline `20_000` literal at `findBestMealSet`, producing 6–11 second JS
 * thread freezes on iPhone 12 / equivalent at pool ≥ 30 recipes × 4 slots.
 * Cap dropped to 2_000 — the existing best-fit pre-sort + 60% top-half bias
 * inside the loop preserve plan variety at the lower count.
 *
 * Exported so tests can pin the value and parity tooling can compare web ↔
 * mobile sampler effort.
 */
export const MEAL_PLAN_SAMPLER_CAP = 2_000;

/**
 * P1-9 (2026-04-25): web ↔ mobile parity. Pre-fix the algorithm shipped
 * twice with divergent constants — mobile penalised recency at +100,
 * web at +40; mobile reset the recency window every 5 days, web every
 * 3; mobile passed `calorieBandPct: 5` at the planner call site, web
 * defaulted to 12. Same user, same recipes, same targets → different
 * plan. CLAUDE.md non-negotiable violation ("web and mobile must stay
 * in sync at all times").
 *
 * Both algorithms now import these constants. The values adopt mobile's
 * stricter behaviour: stronger recency penalty for variety, longer
 * reset window so the first half of a 7-day plan stays unique, tighter
 * macro bands so the planner pushes harder against drift.
 *
 * Pinned by `tests/unit/mealPlanWebMobileParity.test.ts` — that test
 * runs the same fixture pool through both algorithms with the same
 * seed and asserts the resulting day plans match. Reintroducing a
 * divergence (different constant in either file, or a hardcoded value
 * at a call site that bypasses the import) fails the test.
 */
export const MEAL_PLAN_RECENCY_PENALTY = 100;
export const MEAL_PLAN_RECENCY_RESET_DAYS = 5;

/** Shared default macro tolerance bands for the planner UI on both
 *  platforms. Was 12/18 on web, hardcoded 5/15 on mobile pre P1-9.
 *  Adopted mobile's stricter values since Suppr's pitch is precision. */
export const DEFAULT_PLANNER_BANDS = {
  calorieBandPct: 5,
  carbFatBandPct: 15,
} as const;

/**
 * P2-28 (2026-04-25): minimum recipe shape the generic sampler operates
 * on. Both mobile (`SimpleRecipe`) and web (`RecipeCard`) include all
 * these fields; the generic `findBestMealSet<R>` takes any `R extends
 * MealPlanRecipe` plus a `slotFitPredicate(recipe, slot)` callback so
 * the algorithm doesn't need to know about platform-specific
 * slot-tag fields (`mealType` on SimpleRecipe vs `mealSlots` on
 * RecipeCard). Closes the structural duplication between
 * `findBestMealSet` here and `findBestSmartMealSet` in
 * `src/lib/planning/generateMealPlan.ts`.
 */
export type MealPlanRecipe = {
  id: string;
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
};

export type SimpleRecipe = MealPlanRecipe & {
  /** Slot tags from DB/UI; readonly tuples (e.g. mobile `PlannerMealSlot[]`) are accepted. */
  mealType?: string | readonly string[] | string[] | null;
};

export type PlannerTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  calorieBandPct: number;
  carbFatBandPct: number;
};

export type PlannerSlotConfig = {
  /** Which meal slots to include, e.g. ["Breakfast", "Lunch", "Dinner"] */
  slots: string[];
};

export type PlanMeal = {
  name: string;
  recipeTitle: string;
  recipeId?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  portionMultiplier?: number;
  isPlaceholder?: boolean;
  /**
   * P1-19 (2026-04-25): true when the recipe's macros were synthesized
   * by `coerceMacrosWhenCaloriesButNoGrams` (kcal known, P/C/F unknown
   * → neutral 28/42/30 split). The journal-write paths refuse rows with
   * this flag (see `nutrition-approximation-policy.md` §A1); the
   * planner UI surfaces an "Estimated · verify" chip on the row so the
   * user sees the planner is showing a neutral split, not real data.
   */
  macrosAreEstimated?: boolean;
};

export type DayPlan = {
  day: number;
  meals: PlanMeal[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
  /**
   * F-15 — grams of protein below the day target after the joint-fit
   * scaler ran. Negative = still under target; 0 / undefined = no gap.
   * Day card surfaces it only when `< -10g` (see MealPlanner + planner.tsx).
   */
  residualProteinGap?: number;
};

export const ALL_MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

/**
 * Shared portion-multiplier clamp used by both the generator's joint-fit
 * scaler and the planner portion stepper on both platforms. Single source
 * of truth so web + mobile can't drift (see F-15). Wider than the old web
 * clamp (0.5..2.0 at 0.25 step) to give the scaler more headroom.
 *
 * Note (P1-23, 2026-04-25): we considered tightening this to discourage
 * "0.3× breakfast + 1.8× lunch" outputs, but the cascading failure
 * mode in the existing tests showed the joint-fit scaler genuinely
 * needs the headroom for low-calorie targets. Spread is now controlled
 * by `mealPlanPortionSpreadPenalty` at scoring time + the 0-macro pool
 * exclusion in `generateMealPlan.ts` (which removes the worst
 * offenders — recipes with no nutritional signal).
 */
/**
 * Polish (2026-04-25 visual-qa) — tightened from {0.2, 2.5, 0.1} to {0.5, 2.0, 0.5}.
 * Tester feedback: "the portioning is still weird — why is one meal 0.5 when
 * another is 1.2 — it would make sense to where possible always do 1 x portion
 * and only where necessary and makes sense reduce the portion. also weird
 * number of decimals."
 *
 * The previous wide range gave the optimizer 23 legal multipliers per slot
 * (0.2, 0.3, …, 2.5), which let it reach for fractions like 0.3× and 1.2×
 * that read as nonsense to humans. The new clamp gives 4: {0.5, 1, 1.5, 2}.
 *
 * Behavioural impact: the joint sampler defaults to 1× per slot (line 627
 * of findBestMealSetGeneric), and `mealPlanDeviationFromOnePenalty` (×18)
 * already penalises drift; with only 4 legal positions and 18× pressure to
 * stay at 1×, the optimizer now lands on whole portions in the common case
 * and only reaches for 0.5× / 1.5× / 2× when calorie / protein bands genuinely
 * demand it. snapMultipliersTowardOneWhileFeasible continues to do its work
 * post-fit. Pinned by tests/unit/mealPlanWebMobileParity.test.ts.
 */
export const PORTION_MULTIPLIER_CLAMP = {
  min: 0.5,
  max: 2.0,
  step: 0.5,
} as const;

/** Step-round + clamp to `PORTION_MULTIPLIER_CLAMP`. */
export function clampPlannerMultiplier(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  const { min, max, step } = PORTION_MULTIPLIER_CLAMP;
  const inv = 1 / step;
  const stepped = Math.round(raw * inv) / inv;
  return Math.min(max, Math.max(min, stepped));
}

/** P2-28: exported so the web wrapper can drop its duplicate copy. */
export function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function recipeFitsSlot(recipe: SimpleRecipe, slot: string): boolean {
  const raw = recipe.mealType;
  const tags: string[] = Array.isArray(raw)
    ? raw.map((t) => String(t).toLowerCase().trim())
    : typeof raw === "string"
      ? [raw.toLowerCase().trim()]
      : [];
  // Untagged recipes fit any slot
  if (tags.length === 0) return true;
  const s = slot.toLowerCase();
  const slotTag = s === "snacks" ? "snack" : s;
  // Tagged recipes only fit their assigned slots
  return tags.includes(slotTag);
}

type Macros = { calories: number; protein: number; carbs: number; fat: number; fiberG?: number };

/** P2-28: exported so the web wrapper can drop its duplicate copy. */
export function scaleMacros(r: Macros, mult: number): Macros {
  // P1-9 (2026-04-25): 1-decimal protein/carbs/fat for parity with the
  // web algorithm (was integer rounding). The kcal value stays integer.
  return {
    calories: Math.round(r.calories * mult),
    protein: Math.round(r.protein * mult * 10) / 10,
    carbs: Math.round(r.carbs * mult * 10) / 10,
    fat: Math.round(r.fat * mult * 10) / 10,
    fiberG: r.fiberG != null ? Math.round(r.fiberG * mult * 10) / 10 : undefined,
  };
}

/**
 * P2-28: exported scoring function so the web wrapper drops its
 * duplicate copy. Previously web used a flat `×2` calorie out-of-band
 * penalty + a soft `+80` per duplicate; mobile (this canonical) uses
 * an asymmetric `×3` over / `×1.5` under penalty + a hard reject on
 * within-day duplicates. Adopted mobile's behaviour for both
 * platforms — better aligned with Suppr's "precision over breadth"
 * positioning (over-target is worse for cutting users; in-day
 * duplicates are a guarantee, not a soft preference).
 */
export function scoreMealSetCanonical(
  meals: Macros[],
  targets: PlannerTargets,
  recipeIds: string[],
  recentIds: Set<string>,
): number {
  return scoreMealSet(meals, targets, recipeIds, recentIds);
}

function scoreMealSet(
  meals: Macros[],
  targets: PlannerTargets,
  recipeIds: string[],
  recentIds: Set<string>,
): number {
  const sum = meals.reduce(
    (a, m) => ({ calories: a.calories + m.calories, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  let e = 0;

  // Calorie scoring — tighter band, overshooting penalised more than undershooting
  const calDiff = sum.calories - targets.calories;
  const calBand = targets.calories * (targets.calorieBandPct / 100);
  if (Math.abs(calDiff) <= calBand) {
    e += Math.abs(calDiff) * 0.05;
  } else if (calDiff > 0) {
    // Over target — penalise harder (user is likely cutting)
    e += calDiff * 3;
  } else {
    e += Math.abs(calDiff) * 1.5;
  }

  // Protein scoring — highest priority
  const proDiff = sum.protein - targets.protein;
  if (Math.abs(proDiff) <= targets.protein * 0.15) {
    e += Math.abs(proDiff) * 0.1;
  } else {
    e += Math.abs(proDiff) * 4;
  }

  // Carbs
  const carbDiff = sum.carbs - targets.carbs;
  if (Math.abs(carbDiff) <= targets.carbs * 0.2) {
    e += Math.abs(carbDiff) * 0.05;
  } else {
    e += Math.abs(carbDiff) * 0.8;
  }

  // Fat
  const fatDiff = sum.fat - targets.fat;
  if (Math.abs(fatDiff) <= targets.fat * 0.2) {
    e += Math.abs(fatDiff) * 0.05;
  } else {
    e += Math.abs(fatDiff) * 0.8;
  }

  // Hard reject — never the same recipe twice in one day
  const uniq = new Set(recipeIds);
  if (uniq.size < recipeIds.length) return Infinity;

  // Recency penalty — strongly discourage recipes from previous days.
  // P1-9: shared constant for web ↔ mobile parity.
  for (const id of recipeIds) {
    if (recentIds.has(id)) e += MEAL_PLAN_RECENCY_PENALTY;
  }

  return e;
}

const SLOT_WEIGHTS: Record<string, number> = {
  breakfast: 0.25,
  lunch: 0.3,
  dinner: 0.35,
  snack: 0.1,
  snacks: 0.1,
};

/** P2-28: exported so the web wrapper can reuse the slot weighting. */
export function slotCalorieTargets(slots: string[], targets: PlannerTargets): number[] {
  const totalWeight = slots.reduce((a, s) => a + (SLOT_WEIGHTS[s.toLowerCase()] ?? 0.25), 0);
  return slots.map((s) => {
    const w = (SLOT_WEIGHTS[s.toLowerCase()] ?? 0.25) / totalWeight;
    return targets.calories * w;
  });
}

// ---------------------------------------------------------------------------
// F-15 — joint macro-fit scaler.
//
// Input: picked recipes + per-slot default multipliers (the generator's
//   initial guess, typically a per-slot calorie share).
// Output: adjusted multipliers + a `residualProteinGap` (negative grams when
//   the best-achievable total is still under the protein target by >0g).
//
// Objective (weighted, highest priority first):
//   1. Protein — within ±10% of the daily protein target.
//   2. Calories — within ±5% of the daily calorie target.
//   3. Carbs + fat — within ±15% combined; if conflict, minimise
//      |carbs_delta| + |fat_delta|.
//
// Algorithm: iterate slots largest-to-smallest by default calories, adjusting
// each multiplier within the shared `PORTION_MULTIPLIER_CLAMP`. Stop when
// all three bands are satisfied or every lever is clamped. Portion-first;
// swap is surfaced as a hint (not executed here) via `residualProteinGap`.
// ---------------------------------------------------------------------------

export type JointFitInput = {
  /** Base (1x) macros per picked recipe, in slot order. */
  recipes: readonly Macros[];
  /** Initial multipliers in slot order (usually the per-slot calorie share). */
  multipliers: readonly number[];
  targets: PlannerTargets;
};

export type JointFitResult = {
  /** Rounded to `PORTION_MULTIPLIER_CLAMP.step`, clamped to min/max. */
  multipliers: number[];
  /**
   * Grams below the protein target after scaling. Zero when we hit the
   * lower band (target × 0.9). Negative when still short. Never positive
   * (overshooting protein is not a "gap").
   */
  residualProteinGap: number;
};

function sumMacros(rs: readonly Macros[], mults: readonly number[]): Macros {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  for (let i = 0; i < rs.length; i++) {
    const m = mults[i] ?? 1;
    const r = rs[i]!;
    calories += r.calories * m;
    protein += r.protein * m;
    carbs += r.carbs * m;
    fat += r.fat * m;
  }
  return { calories, protein, carbs, fat };
}

/** Sampler score bump: prefer per-slot multipliers near 1.0× (full portions). */
export function mealPlanDeviationFromOnePenalty(multipliers: readonly number[]): number {
  let s = 0;
  for (const m of multipliers) {
    if (Number.isFinite(m)) s += Math.abs(m - 1);
  }
  return s * 18;
}

/**
 * After the iterative fit, nudge each multiplier one 0.1 step toward 1.0
 * whenever the joint macro bands still hold — removes "0.8× / 1.2×"
 * artefacts when 1× for everyone is equally valid.
 */
function snapMultipliersTowardOneWhileFeasible(
  recipes: readonly Macros[],
  multsIn: readonly number[],
  targets: PlannerTargets,
): number[] {
  const n = recipes.length;
  if (n === 0) return [];
  const mults = multsIn.map((m) => clampPlannerMultiplier(m));
  const proLo = targets.protein * 0.9;
  const proHi = targets.protein * 1.1;
  const calLo = targets.calories * 0.95;
  const calHi = targets.calories * 1.05;
  const cfBand = (targets.carbs + targets.fat) * 0.15;
  const inBand = (m: readonly number[]) => {
    const s = sumMacros(recipes, m);
    const proOk = s.protein >= proLo && s.protein <= proHi;
    const calOk = s.calories >= calLo && s.calories <= calHi;
    const cfOk = Math.abs(s.carbs - targets.carbs) + Math.abs(s.fat - targets.fat) <= cfBand;
    return proOk && calOk && cfOk;
  };
  if (!inBand(mults)) return mults;

  const { step } = PORTION_MULTIPLIER_CLAMP;
  for (let round = 0; round < 48; round++) {
    let changed = false;
    const order = mults
      .map((m, i) => ({ i, d: Math.abs(m - 1) }))
      .sort((a, b) => b.d - a.d);
    for (const { i } of order) {
      const cur = mults[i]!;
      if (Math.abs(cur - 1) < step / 2 - 1e-9) continue;
      const dir = cur > 1 ? -1 : 1;
      const trialM = clampPlannerMultiplier(cur + dir * step);
      if (trialM === cur) continue;
      const prev = mults[i]!;
      mults[i] = trialM;
      if (!inBand(mults)) {
        mults[i] = prev;
      } else {
        changed = true;
      }
    }
    if (!changed) break;
  }
  return mults;
}

export function fitDayToTargets(input: JointFitInput): JointFitResult {
  const { recipes, targets } = input;
  const n = recipes.length;
  if (n === 0) {
    return { multipliers: [], residualProteinGap: 0 };
  }

  // Clamp the starting multipliers to the shared clamp.
  const mults = input.multipliers.map((m) => clampPlannerMultiplier(m));

  // Band edges (protein ±10%, calories ±5%, carbs+fat combined ±15%).
  const proLo = targets.protein * 0.9;
  const proHi = targets.protein * 1.1;
  const calLo = targets.calories * 0.95;
  const calHi = targets.calories * 1.05;
  const cfBand = (targets.carbs + targets.fat) * 0.15;

  // Slot order: largest default calories first (largest levers first).
  const order = recipes
    .map((r, i) => ({ i, cals: r.calories * (input.multipliers[i] ?? 1) }))
    .sort((a, b) => b.cals - a.cals)
    .map((x) => x.i);

  const inBand = () => {
    const s = sumMacros(recipes, mults);
    const proOk = s.protein >= proLo && s.protein <= proHi;
    const calOk = s.calories >= calLo && s.calories <= calHi;
    const cfOk = Math.abs(s.carbs - targets.carbs) + Math.abs(s.fat - targets.fat) <= cfBand;
    return { proOk, calOk, cfOk, all: proOk && calOk && cfOk };
  };

  // Cap iterations: each slot can move at most (max - min) / step times
  // per direction; several sweeps handles the worst case comfortably.
  const maxSweeps = 12;
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    const before = mults.slice();
    const status = inBand();
    if (status.all) break;

    // Priority 1: protein out of band — drive toward target using the
    // protein-densest slots first.
    if (!status.proOk) {
      const lever = order
        .slice()
        .sort((a, b) => {
          const dA = recipes[a]!.calories > 0 ? recipes[a]!.protein / recipes[a]!.calories : 0;
          const dB = recipes[b]!.calories > 0 ? recipes[b]!.protein / recipes[b]!.calories : 0;
          return dB - dA;
        });
      for (const i of lever) {
        const r = recipes[i]!;
        if (r.protein <= 0) continue;
        const s = sumMacros(recipes, mults);
        const gap = targets.protein - s.protein;
        if (gap >= -(targets.protein * 0.1) && gap <= (targets.protein * 0.1)) break;
        const delta = gap / r.protein;
        mults[i] = clampPlannerMultiplier(mults[i]! + delta);
      }
    }

    // Priority 2: calories out of band — use protein-poor levers so we
    // don't whiplash the protein we just fixed.
    const postProStatus = inBand();
    if (!postProStatus.calOk) {
      const lever = order
        .slice()
        .sort((a, b) => {
          const dA = recipes[a]!.calories > 0 ? recipes[a]!.protein / recipes[a]!.calories : Infinity;
          const dB = recipes[b]!.calories > 0 ? recipes[b]!.protein / recipes[b]!.calories : Infinity;
          return dA - dB;
        });
      for (const i of lever) {
        const r = recipes[i]!;
        if (r.calories <= 0) continue;
        const s = sumMacros(recipes, mults);
        const diff = targets.calories - s.calories;
        if (Math.abs(diff) <= targets.calories * 0.05) break;
        // Cap at ±0.5 per step so a single cheap slot can't absorb the
        // whole delta and blow up protein.
        const raw = diff / r.calories;
        const clamped = Math.max(-0.5, Math.min(0.5, raw));
        const next = clampPlannerMultiplier(mults[i]! + clamped);
        const prevMult = mults[i]!;
        mults[i] = next;
        const after = sumMacros(recipes, mults);
        if (after.protein < proLo || after.protein > proHi) {
          // Walk back — calories win was not worth the protein breach.
          mults[i] = prevMult;
        }
      }
    }

    // Priority 3: carbs + fat polish. Nudge the largest-calorie slot by
    // one step in the right direction — but only when it keeps protein
    // and calories in band.
    const postCalStatus = inBand();
    if (!postCalStatus.cfOk && postCalStatus.proOk && postCalStatus.calOk) {
      const s = sumMacros(recipes, mults);
      const cfDiff = (targets.carbs + targets.fat) - (s.carbs + s.fat);
      if (cfDiff !== 0) {
        const i = order[0]!;
        const r = recipes[i]!;
        if (r.carbs + r.fat > 0) {
          const dir = cfDiff > 0 ? 1 : -1;
          const trial = clampPlannerMultiplier(mults[i]! + dir * PORTION_MULTIPLIER_CLAMP.step);
          const saved = mults[i]!;
          mults[i] = trial;
          const after = sumMacros(recipes, mults);
          const stillPro = after.protein >= proLo && after.protein <= proHi;
          const stillCal = after.calories >= calLo && after.calories <= calHi;
          if (!stillPro || !stillCal) {
            mults[i] = saved;
          }
        }
      }
    }

    // Early exit: no change this sweep → clamped out, stop.
    let changed = false;
    for (let k = 0; k < mults.length; k++) {
      if (before[k] !== mults[k]) { changed = true; break; }
    }
    if (!changed) break;
  }

  const snapped = snapMultipliersTowardOneWhileFeasible(recipes, mults, targets);
  for (let i = 0; i < n; i++) {
    mults[i] = snapped[i]!;
  }

  const final = sumMacros(recipes, mults);
  // Residual protein gap — negative grams below lower band; 0 when at or
  // above the lower band. UI surfaces it only at `< -10g` (don't nag).
  const proteinShort = proLo - final.protein;
  const residualProteinGap = proteinShort > 0 ? -Math.round(proteinShort) : 0;

  return { multipliers: mults, residualProteinGap };
}

// P2-28 (2026-04-25): the closed-over `findBestMealSet` for SimpleRecipe
// is gone. Mobile + web both run through `findBestMealSetGeneric` above
// with their respective slotFitPredicate. The dedup makes future scoring
// changes a one-file edit instead of a two-file lockstep.

/**
 * P2-28 (2026-04-25): generic version of `findBestMealSet` that any
 * `R extends MealPlanRecipe` can flow through. The slot-fit predicate
 * is a parameter so the algorithm doesn't need to know about
 * platform-specific tag fields (`mealType` on SimpleRecipe vs
 * `mealSlots` on RecipeCard). Both web and mobile call this; the
 * older `findBestMealSet` (closed over `SimpleRecipe`) stays around as
 * the inline mobile path.
 */
export function findBestMealSetGeneric<R extends MealPlanRecipe>(
  pool: R[],
  slots: string[],
  targets: PlannerTargets,
  recentIds: Set<string>,
  rand: () => number,
  slotFitPredicate: (recipe: R, slot: string) => boolean,
): { recipes: R[]; multipliers: number[]; residualProteinGap: number } | null {
  if (pool.length === 0) return null;

  const perSlot = slots.map((slot) => pool.filter((r) => slotFitPredicate(r, slot)));
  if (perSlot.some((p) => p.length === 0)) return null;

  const slotCalTargets = slotCalorieTargets(slots, targets);

  let best:
    | { recipes: R[]; multipliers: number[]; score: number; residualProteinGap: number }
    | null = null;

  const samples = Math.min(MEAL_PLAN_SAMPLER_CAP, perSlot.reduce((a, p) => a * p.length, 1));

  // Pre-sort each slot's pool by closeness to slot target (best-fit first).
  const sortedPerSlot = perSlot.map((slotPool, j) =>
    [...slotPool].sort(
      (a, b) =>
        Math.abs(a.calories - slotCalTargets[j]!) -
        Math.abs(b.calories - slotCalTargets[j]!),
    ),
  );

  for (let i = 0; i < samples; i++) {
    // Bias toward better-fitting recipes: 60% chance of picking from top half.
    const picks = sortedPerSlot.map((p) => {
      const useTop = rand() < 0.6;
      const half = Math.max(1, Math.floor(p.length / 2));
      const slotPool = useTop ? p.slice(0, half) : p;
      return slotPool[Math.floor(rand() * slotPool.length)]!;
    });
    const ids = picks.map((r) => r.id);

    // Seed at 1.0× per slot; the joint fitter only moves levers when the
    // bands require it (F-73 + P1-9).
    const initial = picks.map(() => 1);
    const fit = fitDayToTargets({ recipes: picks, multipliers: initial, targets });
    const multipliers = fit.multipliers;

    const scaledMeals = picks.map((r, j) => scaleMacros(r, multipliers[j]!));
    const s =
      scoreMealSet(scaledMeals, targets, ids, recentIds) +
      mealPlanPortionSpreadPenalty(multipliers) +
      mealPlanDeviationFromOnePenalty(multipliers);

    if (!best || s < best.score) {
      best = {
        recipes: picks,
        multipliers,
        score: s,
        residualProteinGap: fit.residualProteinGap,
      };
    }
  }

  return best;
}

/**
 * P2-28: generic fallback path. When no slot has any matching recipe,
 * the joint sampler returns null; this picks one recipe per slot that
 * has ≥1 fit (allowing partial days).
 */
export function buildIndependentSlotDayGeneric<R extends MealPlanRecipe>(
  pool: R[],
  slots: string[],
  targets: PlannerTargets,
  rand: () => number,
  slotFitPredicate: (recipe: R, slot: string) => boolean,
): {
  picks: { pick: R; name: string; slotIndex: number }[];
  multipliers: number[];
  pickedIds: string[];
  residualProteinGap: number;
} {
  const picks: { pick: R; name: string; slotIndex: number }[] = [];
  const pickedIds: string[] = [];
  for (let j = 0; j < slots.length; j++) {
    const name = slots[j]!;
    const fits = pool.filter((r) => slotFitPredicate(r, name));
    if (fits.length === 0) continue;
    const pick = fits[Math.floor(rand() * fits.length)]!;
    pickedIds.push(pick.id);
    picks.push({ pick, name, slotIndex: j });
  }
  if (picks.length === 0) {
    return { picks, multipliers: [], pickedIds, residualProteinGap: 0 };
  }
  const initial = picks.map(() => 1);
  const fit = fitDayToTargets({
    recipes: picks.map((p) => p.pick),
    multipliers: initial,
    targets,
  });
  return {
    picks,
    multipliers: fit.multipliers,
    pickedIds,
    residualProteinGap: fit.residualProteinGap,
  };
}

function buildIndependentSlotDay(
  pool: SimpleRecipe[],
  slots: string[],
  targets: PlannerTargets,
  rand: () => number,
): { meals: PlanMeal[]; pickedIds: string[]; residualProteinGap: number } {
  const picks: { pick: SimpleRecipe; name: string; slotIndex: number }[] = [];
  const pickedIds: string[] = [];
  for (let j = 0; j < slots.length; j++) {
    const name = slots[j]!;
    const fits = pool.filter((r) => recipeFitsSlot(r, name));
    if (fits.length === 0) continue;
    const pick = fits[Math.floor(rand() * fits.length)]!;
    pickedIds.push(pick.id);
    picks.push({ pick, name, slotIndex: j });
  }
  if (picks.length === 0) {
    return { meals: [], pickedIds, residualProteinGap: 0 };
  }
  // F-15 — same joint-fit treatment as `findBestMealSet`. Even with
  // partial day coverage we push toward the day-level protein target
  // rather than stopping at per-slot calorie shares.
  const initial = picks.map(() => 1);
  const fit = fitDayToTargets({
    recipes: picks.map((p) => p.pick),
    multipliers: initial,
    targets,
  });
  const meals: PlanMeal[] = picks.map(({ pick, name }, j) => {
    const mult = fit.multipliers[j]!;
    const scaled = scaleMacros(pick, mult);
    return {
      name,
      recipeTitle: pick.title,
      recipeId: pick.id,
      calories: scaled.calories,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      fiberG: scaled.fiberG,
      // P1-19: thread coercion flag from the independent-slot fallback path too.
      ...((pick as { isCoerced?: boolean }).isCoerced ? { macrosAreEstimated: true as const } : {}),
    };
  });
  return { meals, pickedIds, residualProteinGap: fit.residualProteinGap };
}

export function generateSmartPlan(input: {
  recipes: SimpleRecipe[];
  targets: PlannerTargets;
  days: number;
  slotConfig?: PlannerSlotConfig;
  /** Seed for reproducibility — defaults to Date.now() for fresh plans */
  seed?: number;
}): DayPlan[] {
  const { recipes, targets } = input;
  const pool = recipes.map((r) => ({
    ...r,
    ...coerceMacrosWhenCaloriesButNoGrams({
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      fiberG: r.fiberG,
    }),
  }));
  const daysCount = Math.min(7, Math.max(1, Math.floor(input.days)));
  const slots = input.slotConfig?.slots ?? ["Breakfast", "Lunch", "Snacks", "Dinner"];
  const baseSeed = input.seed ?? Date.now();

  const recentIds = new Set<string>();
  const usedCombinations = new Set<string>();
  const plans: DayPlan[] = [];

  for (let d = 1; d <= daysCount; d++) {
    // Clear recency on the configured cadence (P1-9 shared constant).
    if (d > 1 && (d - 1) % MEAL_PLAN_RECENCY_RESET_DAYS === 0) recentIds.clear();

    // Unique seed per day
    const rand = mulberry32(baseSeed + d * 7919 + pool.length * 31);

    // P2-28 (2026-04-25): mobile + web both run through the exported
    // generic `findBestMealSetGeneric`. The closed-over `findBestMealSet`
    // is now a thin wrapper, kept for any direct in-file callers.
    const joint = findBestMealSetGeneric(pool, slots, targets, recentIds, rand, recipeFitsSlot);
    let meals: PlanMeal[];
    let residualProteinGap = 0;
    if (joint) {
      for (const r of joint.recipes) recentIds.add(r.id);
      meals = slots.map((name, i) => {
        const r = joint.recipes[i]!;
        const mult = joint.multipliers[i]!;
        const scaled = scaleMacros(r, mult);
        return {
          name,
          recipeTitle: r.title,
          recipeId: r.id,
          ...scaled,
          fiberG: scaled.fiberG,
          // P1-19: thread the coercion flag from the pool through to the
          // rendered row so the planner UI can surface "Estimated · verify".
          ...((r as { isCoerced?: boolean }).isCoerced ? { macrosAreEstimated: true as const } : {}),
          // portionMultiplier is intentionally NOT set here: the fit
          // multiplier is already baked into `calories`. Setting it would
          // cause dayPlanTotalsFromMeals to double-apply the scale.
        };
      });
      residualProteinGap = joint.residualProteinGap;
    } else {
      // Polish (2026-04-25 visual-qa): re-sample the independent fallback
      // up to 3 times with offset RNG seeds and keep the closest-to-target
      // candidate. Tester feedback was that small-pool plans drifted
      // wildly (1,181 kcal vs 1,800 kcal target) because the first
      // independent build was always accepted regardless of fit. Bounded
      // 4-candidate cost; dramatically tightens the calorie envelope.
      let bestIndependent = buildIndependentSlotDay(pool, slots, targets, rand);
      const sumCals = (m: typeof bestIndependent.meals) =>
        m.reduce((a, x) => a + (x.calories ?? 0), 0);
      let bestDrift = Math.abs(sumCals(bestIndependent.meals) - targets.calories);
      for (let retry = 1; retry <= 3; retry++) {
        const retryRand = mulberry32(baseSeed + d * 7919 + retry * 13337 + pool.length * 31);
        const candidate = buildIndependentSlotDay(pool, slots, targets, retryRand);
        const candidateDrift = Math.abs(sumCals(candidate.meals) - targets.calories);
        if (candidateDrift < bestDrift) {
          bestIndependent = candidate;
          bestDrift = candidateDrift;
        }
      }
      meals = bestIndependent.meals;
      residualProteinGap = bestIndependent.residualProteinGap;
      for (const id of bestIndependent.pickedIds) recentIds.add(id);
    }

    // Reject exact duplicate day combinations — retry with a different seed
    const combo = meals.map((m) => m.recipeId ?? m.recipeTitle).sort().join("|");
    if (usedCombinations.has(combo) && pool.length > slots.length) {
      // Try up to 3 retries with offset seeds
      for (let retry = 1; retry <= 3; retry++) {
        const retryRand = mulberry32(baseSeed + d * 7919 + retry * 13337);
        const retryJoint = findBestMealSetGeneric(pool, slots, targets, recentIds, retryRand, recipeFitsSlot);
        if (retryJoint) {
          const retryCombo = retryJoint.recipes.map((r) => r.id).sort().join("|");
          if (!usedCombinations.has(retryCombo)) {
            for (const r of retryJoint.recipes) recentIds.add(r.id);
            meals = slots.map((name, i) => {
              const r = retryJoint.recipes[i]!;
              const mult = retryJoint.multipliers[i]!;
              const scaled = scaleMacros(r, mult);
              return {
                name,
                recipeTitle: r.title,
                recipeId: r.id,
                ...scaled,
                // Same as primary branch — fit multiplier is baked into macros;
                // never set `portionMultiplier` or day totals double-apply (F-70).
              };
            });
            residualProteinGap = retryJoint.residualProteinGap;
            break;
          }
        }
      }
    }
    const finalCombo = meals.map((m) => m.recipeId ?? m.recipeTitle).sort().join("|");
    usedCombinations.add(finalCombo);

    const totals = meals.reduce(
      (a, m) => ({
        calories: a.calories + m.calories,
        protein: a.protein + m.protein,
        carbs: a.carbs + m.carbs,
        fat: a.fat + m.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    plans.push({
      day: d,
      meals,
      totals,
      ...(residualProteinGap < 0 ? { residualProteinGap } : {}),
    });
  }

  return plans;
}
