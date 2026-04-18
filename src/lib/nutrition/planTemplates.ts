/**
 * Plan templates (Batch 3.10).
 *
 * A template is a reusable snapshot of a week (or 1–7 day slice) of a meal plan.
 * The template stores per-slot recipe references, the slot label, and the
 * portion multiplier — but NOT any per-user runtime state (date keys,
 * servings-used counters, logged flags, leftover distribution). Applying a
 * template to a week re-expands it into a fresh `DayPlan[]` that the rest of
 * the planner treats identically to a generated plan.
 *
 * This file is imported by both web (`src/app/components/MealPlanner.tsx`) and
 * mobile (`apps/mobile/app/(tabs)/planner.tsx`) via a relative re-export, so
 * any behaviour changes here must be reflected in both planners.
 */

import type { DayPlan, DayPlanMeal } from "../../types/recipe.ts";

/** One row of a template — mirrors a `DayPlanMeal` with a bound `dayIndex` + slot label. */
export interface PlanTemplateSlot {
  /** 0-indexed day within the template (0 = first day). */
  dayIndex: number;
  /** Slot label ("Breakfast" | "Lunch" | "Snacks" | "Dinner"). */
  slot: string;
  recipeId?: string;
  recipeTitle: string;
  /** Base per-serving macros (multiplier 1 — the consumer scales by `portionMultiplier` at apply time). */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  /** Servings this slot represents (1 = one plate). Stored flat — leftover state is inferred on apply. */
  servings: number;
  portionMultiplier: number;
}

export interface PlanTemplate {
  id: string;
  userId: string;
  name: string;
  /** 1..7 — number of distinct day indices covered by the template. */
  dayCount: number;
  slots: PlanTemplateSlot[];
  createdAt: string;
  updatedAt: string;
}

/** Server-less draft prior to persisting — `id`, `userId`, timestamps are assigned by the DB layer. */
export interface PlanTemplateDraft {
  name: string;
  dayCount: number;
  slots: PlanTemplateSlot[];
}

/** 1 ≤ name length ≤ 80 (matches DB check constraint). */
const NAME_MIN = 1;
const NAME_MAX = 80;

function isNonEmptyMeal(meal: DayPlanMeal): boolean {
  if (meal.isPlaceholder) return false;
  const title = (meal.recipeTitle ?? "").trim();
  if (!title) return false;
  // Leftover slots are derived on apply — don't persist them as template rows
  // (the parent carries enough info to re-distribute).
  if ((meal as DayPlanMeal & { leftoverOf?: string }).leftoverOf) return false;
  return true;
}

/**
 * Build a template draft from a `DayPlan[]`. Strips runtime-only state
 * (leftovers, logged flags) and collapses to the minimum record needed to
 * re-apply on any other week.
 *
 * - `dayCount` clamps to 1..7 and to the number of distinct days with meals.
 * - Returns `null` if the week has zero meals — callers must fail loudly.
 *   (The UI turns this into "This plan has no meals to save.")
 */
export function buildTemplateFromWeek(
  plan: DayPlan[] | null | undefined,
  name: string,
  dayCount: number,
): PlanTemplateDraft | null {
  if (!plan || plan.length === 0) return null;

  const trimmedName = name.trim();
  if (trimmedName.length < NAME_MIN || trimmedName.length > NAME_MAX) return null;

  const safeDayCount = Math.max(1, Math.min(7, Math.floor(dayCount)));
  const slice = plan.slice(0, safeDayCount);

  const slots: PlanTemplateSlot[] = [];
  for (const day of slice) {
    // `day.day` is 1-indexed (existing convention). Template rows use 0-indexed dayIndex.
    const dayIndex = Math.max(0, (day.day ?? 1) - 1);
    if (dayIndex >= safeDayCount) continue; // defensive — clamp to requested slice
    for (const meal of day.meals ?? []) {
      if (!isNonEmptyMeal(meal)) continue;
      const portion = meal.portionMultiplier && meal.portionMultiplier > 0 ? meal.portionMultiplier : 1;
      slots.push({
        dayIndex,
        slot: meal.name,
        recipeId: (meal as DayPlanMeal & { recipeId?: string }).recipeId,
        recipeTitle: meal.recipeTitle,
        calories: Math.round(meal.calories / portion),
        protein: +(meal.protein / portion).toFixed(2),
        carbs: +(meal.carbs / portion).toFixed(2),
        fat: +(meal.fat / portion).toFixed(2),
        fiberG: (meal as DayPlanMeal & { fiberG?: number }).fiberG != null
          ? +((meal as DayPlanMeal & { fiberG?: number }).fiberG! / portion).toFixed(2)
          : undefined,
        servings: 1,
        portionMultiplier: portion,
      });
    }
  }

  if (slots.length === 0) return null;

  return { name: trimmedName, dayCount: safeDayCount, slots };
}

/**
 * Returns a human-readable error string, or null if the draft is valid.
 * Used by both UI validation and the DB insert guard.
 */
export function validatePlanTemplate(draft: PlanTemplateDraft | null | undefined): string | null {
  if (!draft) return "This plan has no meals to save.";
  const name = (draft.name ?? "").trim();
  if (name.length < NAME_MIN) return "Name is required.";
  if (name.length > NAME_MAX) return `Name must be ${NAME_MAX} characters or fewer.`;
  if (!Number.isFinite(draft.dayCount) || draft.dayCount < 1 || draft.dayCount > 7) {
    return "Day count must be between 1 and 7.";
  }
  if (!Array.isArray(draft.slots) || draft.slots.length === 0) {
    return "This plan has no meals to save.";
  }
  for (const s of draft.slots) {
    if (!Number.isInteger(s.dayIndex) || s.dayIndex < 0 || s.dayIndex >= draft.dayCount) {
      return "One or more slots are outside the template's day range.";
    }
    if (!s.slot || typeof s.slot !== "string") return "Slot label is required.";
    if (!s.recipeTitle || typeof s.recipeTitle !== "string") return "Recipe is required.";
    if (!Number.isFinite(s.portionMultiplier) || s.portionMultiplier <= 0) {
      return "Portion multiplier must be positive.";
    }
  }
  return null;
}

/**
 * Apply a template to a target week, starting from `startDateKey`
 * (ISO `YYYY-MM-DD`). Returns a `DayPlan[]` shaped identically to what
 * `generateSmartPlan` produces so downstream persistence + UI don't need
 * to special-case templates.
 *
 * Date math: uses local-timezone `Date` rollover — the UI already displays
 * plan rows relative to the user's `Date.now()`, so month boundaries
 * (e.g. 2026-01-30 + 3 days = 2026-02-02) Just Work.
 */
export function applyTemplateToWeek(
  template: Pick<PlanTemplate, "slots" | "dayCount">,
): DayPlan[] {
  const safeDayCount = Math.max(1, Math.min(7, Math.floor(template.dayCount)));
  const byDay = new Map<number, DayPlanMeal[]>();
  for (let i = 0; i < safeDayCount; i++) byDay.set(i, []);

  for (const s of template.slots) {
    if (s.dayIndex < 0 || s.dayIndex >= safeDayCount) continue;
    const portion = s.portionMultiplier && s.portionMultiplier > 0 ? s.portionMultiplier : 1;
    const meal: DayPlanMeal & { recipeId?: string; fiberG?: number } = {
      name: s.slot,
      recipeTitle: s.recipeTitle,
      recipeId: s.recipeId,
      calories: Math.round(s.calories * portion),
      protein: +(s.protein * portion).toFixed(2),
      carbs: +(s.carbs * portion).toFixed(2),
      fat: +(s.fat * portion).toFixed(2),
      fiberG: s.fiberG != null ? +(s.fiberG * portion).toFixed(2) : undefined,
      portionMultiplier: portion !== 1 ? portion : undefined,
    };
    byDay.get(s.dayIndex)!.push(meal);
  }

  const plans: DayPlan[] = [];
  for (let i = 0; i < safeDayCount; i++) {
    const meals = byDay.get(i) ?? [];
    const totals = meals.reduce(
      (acc, m) => ({
        calories: acc.calories + (m.calories ?? 0),
        protein: acc.protein + (m.protein ?? 0),
        carbs: acc.carbs + (m.carbs ?? 0),
        fat: acc.fat + (m.fat ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    plans.push({ day: i + 1, meals, totals });
  }
  return plans;
}

/**
 * Expand a 0-indexed `dayIndex` against a start-date key, returning a
 * local-time `YYYY-MM-DD` string. Exposed for UI previews.
 */
export function dayIndexToDateKey(startDateKey: string, dayIndex: number): string {
  const [y, m, d] = startDateKey.split("-").map(Number);
  const base = new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0); // noon avoids DST edge
  base.setDate(base.getDate() + dayIndex);
  const yy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
