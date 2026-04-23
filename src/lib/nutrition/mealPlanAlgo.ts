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
 */

export type SimpleRecipe = {
  id: string;
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
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
 */
export const PORTION_MULTIPLIER_CLAMP = {
  min: 0.2,
  max: 2.5,
  step: 0.1,
} as const;

/** Step-round + clamp to `PORTION_MULTIPLIER_CLAMP`. */
export function clampPlannerMultiplier(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  const { min, max, step } = PORTION_MULTIPLIER_CLAMP;
  const inv = 1 / step;
  const stepped = Math.round(raw * inv) / inv;
  return Math.min(max, Math.max(min, stepped));
}

function mulberry32(seed: number): () => number {
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

function scaleMacros(r: Macros, mult: number): Macros {
  return {
    calories: Math.round(r.calories * mult),
    protein: Math.round(r.protein * mult),
    carbs: Math.round(r.carbs * mult),
    fat: Math.round(r.fat * mult),
    fiberG: r.fiberG != null ? Math.round(r.fiberG * mult * 10) / 10 : undefined,
  };
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

  // Recency penalty — strongly discourage recipes from previous days
  for (const id of recipeIds) {
    if (recentIds.has(id)) e += 100;
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

function slotCalorieTargets(slots: string[], targets: PlannerTargets): number[] {
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

  const final = sumMacros(recipes, mults);
  // Residual protein gap — negative grams below lower band; 0 when at or
  // above the lower band. UI surfaces it only at `< -10g` (don't nag).
  const proteinShort = proLo - final.protein;
  const residualProteinGap = proteinShort > 0 ? -Math.round(proteinShort) : 0;

  return { multipliers: mults, residualProteinGap };
}

function findBestMealSet(
  pool: SimpleRecipe[],
  slots: string[],
  targets: PlannerTargets,
  recentIds: Set<string>,
  rand: () => number,
): { recipes: SimpleRecipe[]; multipliers: number[]; residualProteinGap: number } | null {
  if (pool.length === 0) return null;

  const perSlot = slots.map((slot) => pool.filter((r) => recipeFitsSlot(r, slot)));
  if (perSlot.some((p) => p.length === 0)) return null;

  const slotCalTargets = slotCalorieTargets(slots, targets);

  let best:
    | { recipes: SimpleRecipe[]; multipliers: number[]; score: number; residualProteinGap: number }
    | null = null;

  const samples = Math.min(20_000, perSlot.reduce((a, p) => a * p.length, 1));

  // Pre-sort each slot's pool by closeness to slot target (best-fit first)
  const sortedPerSlot = perSlot.map((pool, j) =>
    [...pool].sort((a, b) => Math.abs(a.calories - slotCalTargets[j]) - Math.abs(b.calories - slotCalTargets[j])),
  );

  for (let i = 0; i < samples; i++) {
    // Bias toward better-fitting recipes: 60% chance of picking from top half
    const picks = sortedPerSlot.map((p) => {
      const useTop = rand() < 0.6;
      const half = Math.max(1, Math.floor(p.length / 2));
      const pool = useTop ? p.slice(0, half) : p;
      return pool[Math.floor(rand() * pool.length)]!;
    });
    const ids = picks.map((r) => r.id);

    // Initial multipliers hit per-slot calorie share; joint-fit scaler
    // then pushes toward the daily protein / calories / carbs+fat bands.
    const initial = picks.map((r, j) => {
      if (r.calories <= 0) return 1;
      return clampPlannerMultiplier(slotCalTargets[j] / r.calories);
    });

    // F-15 — joint macro-fit scaler.
    const fit = fitDayToTargets({ recipes: picks, multipliers: initial, targets });
    const multipliers = fit.multipliers;

    const scaledMeals = picks.map((r, j) => scaleMacros(r, multipliers[j]));
    const s = scoreMealSet(scaledMeals, targets, ids, recentIds);

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

function buildIndependentSlotDay(
  pool: SimpleRecipe[],
  slots: string[],
  targets: PlannerTargets,
  rand: () => number,
): { meals: PlanMeal[]; pickedIds: string[]; residualProteinGap: number } {
  const slotCalTargets = slotCalorieTargets(slots, targets);
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
  const initial = picks.map(({ pick, slotIndex }) => {
    if (pick.calories <= 0) return 1;
    return clampPlannerMultiplier(slotCalTargets[slotIndex]! / pick.calories);
  });
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
  const daysCount = Math.min(7, Math.max(1, Math.floor(input.days)));
  const slots = input.slotConfig?.slots ?? ["Breakfast", "Lunch", "Snacks", "Dinner"];
  const baseSeed = input.seed ?? Date.now();

  const recentIds = new Set<string>();
  const usedCombinations = new Set<string>();
  const plans: DayPlan[] = [];

  for (let d = 1; d <= daysCount; d++) {
    // Clear recency every 5 days to allow repeats in longer plans
    if (d > 1 && (d - 1) % 5 === 0) recentIds.clear();

    // Unique seed per day
    const rand = mulberry32(baseSeed + d * 7919 + recipes.length * 31);

    const joint = findBestMealSet(recipes, slots, targets, recentIds, rand);
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
          // portionMultiplier is intentionally NOT set here: the fit
          // multiplier is already baked into `calories`. Setting it would
          // cause dayPlanTotalsFromMeals to double-apply the scale.
        };
      });
      residualProteinGap = joint.residualProteinGap;
    } else {
      const { meals: indMeals, pickedIds, residualProteinGap: indGap } =
        buildIndependentSlotDay(recipes, slots, targets, rand);
      meals = indMeals;
      residualProteinGap = indGap;
      for (const id of pickedIds) recentIds.add(id);
    }

    // Reject exact duplicate day combinations — retry with a different seed
    const combo = meals.map((m) => m.recipeId ?? m.recipeTitle).sort().join("|");
    if (usedCombinations.has(combo) && recipes.length > slots.length) {
      // Try up to 3 retries with offset seeds
      for (let retry = 1; retry <= 3; retry++) {
        const retryRand = mulberry32(baseSeed + d * 7919 + retry * 13337);
        const retryJoint = findBestMealSet(recipes, slots, targets, recentIds, retryRand);
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
