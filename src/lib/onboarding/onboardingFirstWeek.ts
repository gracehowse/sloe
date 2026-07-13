/**
 * onboardingFirstWeek — generate + persist the user's first weekly
 * plan from picked seed recipes.
 *
 * Production design spec — 2026-04-27 Surface F.
 * Authority: D-2026-04-27-14 (onboarding produces first plan).
 *
 * Flow:
 *   1. Caller has already resolved seeds → recipe ids and saved them
 *      via `saveResolvedSeeds` in `onboardingSeedResolver.ts`.
 *   2. We turn the resolved seeds into the SimpleRecipe shape required
 *      by `generateSmartPlan`.
 *   3. Run the planner against the user's macro targets to get 7 days
 *      of meal sets.
 *   4. Persist the result through the existing `save_meal_plan` RPC
 *      (server-side validates user_id + week start_date).
 *
 * Failure handling per spec Surface F §State:
 *   - Plan generation produces zero days (impossible at 5+ recipes,
 *     defensive) → caller surfaces "Try regenerate from the Plan tab."
 *   - RPC error → result.ok=false, error string carried.
 *   - Each step independently observable so the caller can decide
 *     whether to bounce to /home with a partial-success toast.
 *
 * Cross-platform: shared helper. Mobile + web both use the same
 * `generateSmartPlan` core; the persist call is a single RPC.
 */

import {
  DEFAULT_PLANNER_BANDS,
  generateSmartPlan,
  type DayPlan,
  type SimpleRecipe,
  type PlannerTargets,
} from "../nutrition/mealPlanAlgo";

import { dateKeyFromDate } from "../datetime/dateKey";

import type { OnboardingSeed } from "./onboardingSeeds";

export type FirstWeekSupabaseClient = any;

export interface FirstWeekTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
}

export interface FirstWeekResolvedSeed {
  seed: OnboardingSeed;
  recipeId: string;
}

export interface BuildFirstWeekResult {
  ok: boolean;
  daysGenerated: number;
  error?: string;
  plan?: DayPlan[];
}

/**
 * Convert resolved seeds into the planner's `SimpleRecipe` shape.
 *
 * Notes:
 *   - The seed list carries display-only kcal + protein. We use them
 *     directly since the planner's job at onboarding is "produce a
 *     plausible week from the user's picks", not deep nutrition
 *     matching. Once the recipe rows resolve in real-time later, the
 *     planner can pull verified macros from the DB.
 *   - Carbs / fat / fibre — derived from kcal + protein using a
 *     conservative default split (45% carb, 30% fat, 5g fibre per
 *     serving). The exactness doesn't materially affect plan
 *     selection; the rebuild from real DB rows will refine the day
 *     totals on first plan refresh.
 */
export function seedsToPlannerRecipes(
  resolved: readonly FirstWeekResolvedSeed[],
): SimpleRecipe[] {
  return resolved.map(({ seed, recipeId }) => {
    const kcal = Math.max(50, Math.round(seed.kcal));
    const proteinKcal = seed.protein_g * 4;
    const remainingKcal = Math.max(50, kcal - proteinKcal);
    // Default split — see file header.
    const carbsKcal = remainingKcal * 0.6;
    const fatKcal = remainingKcal * 0.4;
    return {
      id: recipeId,
      title: seed.title,
      calories: kcal,
      protein: seed.protein_g,
      carbs: Math.round(carbsKcal / 4),
      fat: Math.round(fatKcal / 9),
      fiberG: 5,
      // mealType — leave undefined; the planner allows untagged
      // recipes into any slot.
    } satisfies SimpleRecipe;
  });
}

/**
 * Build + persist the user's first week. Best-effort — saved recipes
 * land first (caller's responsibility); plan generation is independent.
 *
 * If generation succeeds but persist fails, we still return the plan
 * shape so the UI can render an in-memory preview if it wants to.
 */
export async function buildFirstWeekFromSeeds(
  supabase: FirstWeekSupabaseClient,
  args: {
    userId: string;
    resolved: readonly FirstWeekResolvedSeed[];
    targets: FirstWeekTargets;
    /** Plan start date as ISO yyyy-mm-dd. Defaults to today. */
    startDate?: string;
    /** Slot config id — server enforces user-scoped. Defaults to user's
     *  primary slot from `meal_plan_slots`; null lets the RPC pick. */
    slotId?: string;
  },
): Promise<BuildFirstWeekResult> {
  // Defensive: no recipes → no plan possible.
  if (args.resolved.length === 0) {
    return {
      ok: false,
      daysGenerated: 0,
      error: "No resolved recipes to build plan from.",
    };
  }

  const recipes = seedsToPlannerRecipes(args.resolved);

  const plannerTargets: PlannerTargets = {
    calories: args.targets.calories,
    protein: args.targets.proteinG,
    carbs: args.targets.carbsG,
    fat: args.targets.fatG,
    fiber: args.targets.fiberG ?? 0,
    calorieBandPct: DEFAULT_PLANNER_BANDS.calorieBandPct,
    carbFatBandPct: DEFAULT_PLANNER_BANDS.carbFatBandPct,
  };

  let plan: DayPlan[] = [];
  try {
    plan = generateSmartPlan({
      recipes,
      targets: plannerTargets,
      days: 7,
    });
  } catch (e) {

    console.warn("[onboardingFirstWeek] generateSmartPlan threw:", e);
    return {
      ok: false,
      daysGenerated: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  if (plan.length === 0) {
    return {
      ok: false,
      daysGenerated: 0,
      error: "Planner produced 0 days from picked recipes.",
    };
  }

  // ENG-1540 — default the week start to the user's LOCAL calendar day.
  // `toISOString().slice(0,10)` is UTC and rolls to tomorrow after ~17:00
  // local in the Americas, starting the first-week plan on the wrong day.
  const startDate = args.startDate ?? dateKeyFromDate(new Date());
  const slotId = args.slotId ?? null;

  // RPC contract: { p_plan: Json, p_slot_id: string, p_start_date: string }.
  // The server validates user_id from auth.uid(); we don't pass it.
  let rpcError: string | undefined;
  try {
    const { error } = await supabase.rpc("save_meal_plan", {
      p_plan: plan,
      p_slot_id: slotId,
      p_start_date: startDate,
    });
    if (error) {
      rpcError = error.message ?? "save_meal_plan rpc failed";

      console.warn("[onboardingFirstWeek] save_meal_plan rpc failed:", rpcError);
    }
  } catch (e) {
    rpcError = e instanceof Error ? e.message : String(e);

    console.warn("[onboardingFirstWeek] save_meal_plan rpc threw:", rpcError);
  }

  return {
    ok: rpcError == null,
    daysGenerated: plan.length,
    plan,
    error: rpcError,
  };
}
