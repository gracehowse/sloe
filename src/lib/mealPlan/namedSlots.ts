/**
 * Named meal-plan slots — pure CRUD helpers shared between web
 * (`src/context/AppDataContext.tsx`) and mobile
 * (`apps/mobile/hooks/use-meal-plan-slots.ts`).
 *
 * Why a shared module: web persists slot metadata to localStorage and
 * mobile to AsyncStorage. ENG-1130 also syncs slot registry metadata
 * to `profiles.meal_plan_slots`; plan bodies use `save_meal_plan`.
 * Both platforms use the exact
 * same in-memory shape and CRUD rules; that's what this module owns.
 *
 * Anything that's React-specific (state, useEffect, storage I/O)
 * stays in the consuming hook so this file remains pure-TS and
 * runnable in any unit test environment.
 */

import { normalizeDayPlans } from "../nutrition/portionMultiplier";
import type { DayPlan } from "../../types/recipe";

/** Stable id for the first slot every user gets implicitly. Keeps the
 *  default plan stable across upgrades — never change without a
 *  migration. */
export const DEFAULT_MEAL_PLAN_SLOT_ID = "plan-slot-default";

/** Default human-readable label for a brand-new user's only slot. */
export const DEFAULT_MEAL_PLAN_SLOT_NAME = "This week";

/** Maximum slots per user. Matches a sensible mental ceiling
 *  (cut / maintain / family / vacation = 4) plus headroom. */
export const MAX_MEAL_PLAN_SLOTS = 8;

export type MealPlanNamedSlot = {
  id: string;
  name: string;
  /** Active plan for this slot. `null` until generated. */
  plan: DayPlan[] | null;
};

/** Normalise an unknown row from storage into a slot, dropping
 *  malformed entries. Non-array `plan` is treated as empty. Trims
 *  names. Returns null when the row can't be salvaged. */
export function normalizeMealPlanSlot(row: unknown): MealPlanNamedSlot | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Partial<MealPlanNamedSlot>;
  if (typeof o.id !== "string" || !o.id.trim()) return null;
  const name =
    typeof o.name === "string" && o.name.trim()
      ? o.name.trim()
      : DEFAULT_MEAL_PLAN_SLOT_NAME;
  let plan: DayPlan[] | null = null;
  if (o.plan === null) plan = null;
  else if (Array.isArray(o.plan)) plan = normalizeDayPlans(o.plan) ?? null;
  return { id: o.id.trim(), name, plan };
}

/** Generate a new slot id. Web previously used `crypto.randomUUID()`
 *  via a `newId` helper; mobile RN typically has crypto too but we
 *  stay defensive. */
export function newMealPlanSlotId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `planslot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** First slot a brand-new user gets, optionally hydrated with an
 *  existing plan (when migrating from a pre-slots install). */
export function makeDefaultSlot(plan: DayPlan[] | null = null): MealPlanNamedSlot {
  return { id: DEFAULT_MEAL_PLAN_SLOT_ID, name: DEFAULT_MEAL_PLAN_SLOT_NAME, plan };
}

/** Create a new slot with `name` (trimmed) and append it. Returns the
 *  next `slots` array AND the new slot's id so the caller can
 *  immediately switch to it. Enforces `MAX_MEAL_PLAN_SLOTS`. */
export function createSlot(
  slots: readonly MealPlanNamedSlot[],
  name: string,
): { slots: MealPlanNamedSlot[]; id: string } {
  if (slots.length >= MAX_MEAL_PLAN_SLOTS) {
    return { slots: slots.slice(), id: slots[0]!.id };
  }
  const id = newMealPlanSlotId();
  const label = name.trim() || "New plan";
  return { slots: [...slots, { id, name: label, plan: null }], id };
}

/** Rename `slotId` to `name` (trimmed). No-op when `name` is empty
 *  or `slotId` is unknown. */
export function renameSlot(
  slots: readonly MealPlanNamedSlot[],
  slotId: string,
  name: string,
): MealPlanNamedSlot[] {
  const trimmed = name.trim();
  if (!trimmed) return slots.slice();
  return slots.map((s) => (s.id === slotId ? { ...s, name: trimmed } : s));
}

/** Delete `slotId`. Refuses to delete the last remaining slot — the
 *  user must always have at least one. When the deleted slot is the
 *  active one, returns the next active id (first remaining slot). */
export function deleteSlot(
  slots: readonly MealPlanNamedSlot[],
  slotId: string,
  activeId: string,
): { slots: MealPlanNamedSlot[]; activeId: string } {
  if (slots.length <= 1) return { slots: slots.slice(), activeId };
  const filtered = slots.filter((s) => s.id !== slotId);
  if (filtered.length === slots.length) return { slots: slots.slice(), activeId };
  const nextActive = activeId === slotId ? filtered[0]!.id : activeId;
  return { slots: filtered, activeId: nextActive };
}

/** Replace the active slot's `plan`. Used after `generatePlan` /
 *  `setMealPlan`. Pure — caller owns persistence. */
export function setActiveSlotPlan(
  slots: readonly MealPlanNamedSlot[],
  activeId: string,
  nextPlan: DayPlan[] | null,
): MealPlanNamedSlot[] {
  return slots.map((s) => (s.id === activeId ? { ...s, plan: nextPlan } : s));
}

/** Resolve the active plan from the slots + active id. Returns null
 *  when the active id is stale (e.g. slot was deleted by another
 *  device / hand-edited storage). */
export function activePlanFromSlots(
  slots: readonly MealPlanNamedSlot[],
  activeId: string,
): DayPlan[] | null {
  return slots.find((s) => s.id === activeId)?.plan ?? null;
}

/** Hydrate a slots array from arbitrary JSON. Always returns at least
 *  the default slot so the caller never has to handle the empty case.
 *  Optionally hydrates the default slot's plan from a legacy
 *  pre-slots payload. */
export function hydrateSlots(
  raw: unknown,
  legacyPlan: DayPlan[] | null = null,
): MealPlanNamedSlot[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const cleaned = raw
      .map((r) => normalizeMealPlanSlot(r))
      .filter((s): s is MealPlanNamedSlot => Boolean(s));
    if (cleaned.length > 0) return cleaned;
  }
  return [makeDefaultSlot(legacyPlan)];
}
