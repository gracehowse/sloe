/**
 * ENG-1130 — cloud sync helpers for named meal-plan slots.
 *
 * Slot metadata (id + name + active selection) lives on `profiles.meal_plan_slots`.
 * Each slot's plan body is stored relationally via `save_meal_plan(p_slot_id, …)`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { isMealPlanPlaceholderLikeTitle } from "../nutrition/portionMultiplier";
import {
  DEFAULT_MEAL_PLAN_SLOT_ID,
  hydrateSlots,
  type MealPlanNamedSlot,
} from "./namedSlots";
import type { DayPlan } from "../../types/recipe";

/** Cloud slot_id for the canonical default plan (legacy rows). */
export const CLOUD_DEFAULT_SLOT_ID = "default";

/** Map a device-local slot id to the cloud `meal_plan_days.slot_id`. */
export function cloudSlotIdFromLocal(localId: string): string {
  if (localId === DEFAULT_MEAL_PLAN_SLOT_ID) return CLOUD_DEFAULT_SLOT_ID;
  return localId;
}

/** Map a cloud slot_id back to the device-local id. */
export function localSlotIdFromCloud(cloudId: string): string {
  if (cloudId === CLOUD_DEFAULT_SLOT_ID) return DEFAULT_MEAL_PLAN_SLOT_ID;
  return cloudId;
}

export type MealPlanSlotsMetadata = {
  slots: Array<{ id: string; name: string }>;
  active_slot_id: string | null;
};

const EMPTY_METADATA: MealPlanSlotsMetadata = { slots: [], active_slot_id: null };

/** Build the profile JSON blob from in-memory slots + active id. */
export function metadataFromSlots(
  slots: readonly MealPlanNamedSlot[],
  activeSlotId: string,
): MealPlanSlotsMetadata {
  return {
    slots: slots.map((s) => ({ id: s.id, name: s.name })),
    active_slot_id: activeSlotId,
  };
}

/** Parse unknown profile JSON into metadata; returns null when unusable. */
export function parseMealPlanSlotsMetadata(raw: unknown): MealPlanSlotsMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<MealPlanSlotsMetadata>;
  if (!Array.isArray(o.slots)) return null;
  const slots = o.slots
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as { id?: unknown; name?: unknown };
      if (typeof r.id !== "string" || !r.id.trim()) return null;
      const name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : "Plan";
      return { id: r.id.trim(), name };
    })
    .filter((s): s is { id: string; name: string } => Boolean(s));
  if (slots.length === 0) return null;
  const active =
    typeof o.active_slot_id === "string" && slots.some((s) => s.id === o.active_slot_id)
      ? o.active_slot_id
      : slots[0]!.id;
  return { slots, active_slot_id: active };
}

/**
 * Merge cloud metadata into local slots. Preserves inline `plan` payloads
 * for slots that already exist locally; adds cloud-only slots with `plan: null`.
 */
export function mergeCloudMetadataIntoSlots(
  localSlots: readonly MealPlanNamedSlot[],
  metadata: MealPlanSlotsMetadata,
): { slots: MealPlanNamedSlot[]; activeSlotId: string } {
  const byId = new Map(localSlots.map((s) => [s.id, s]));
  const merged: MealPlanNamedSlot[] = metadata.slots.map((meta) => {
    const existing = byId.get(meta.id);
    if (existing) {
      return existing.name === meta.name ? existing : { ...existing, name: meta.name };
    }
    return { id: meta.id, name: meta.name, plan: null };
  });
  const slots = merged.length > 0 ? merged : hydrateSlots(null);
  const activeSlotId =
    metadata.active_slot_id && slots.some((s) => s.id === metadata.active_slot_id)
      ? metadata.active_slot_id
      : slots[0]!.id;
  return { slots, activeSlotId };
}

type MealPlanDayRow = { id: string; day: number; start_date?: string | null };
type MealPlanMealRow = {
  plan_day_id: string;
  slot_index: number;
  name: string;
  recipe_title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portion_multiplier: number;
  is_placeholder: boolean | null;
};

/** Load a slot's plan from relational tables. Returns null when empty / missing. */
export async function fetchMealPlanForLocalSlot(
  supabase: SupabaseClient,
  userId: string,
  localSlotId: string,
): Promise<{ plans: DayPlan[]; startDate: string | null } | null> {
  const cloudSlotId = cloudSlotIdFromLocal(localSlotId);
  const { data: dayRows, error: dayErr } = await supabase
    .from("meal_plan_days")
    .select("id, day, start_date")
    .eq("user_id", userId)
    .eq("slot_id", cloudSlotId)
    .order("day", { ascending: true });

  if (!dayRows || dayRows.length === 0 || dayErr) return null;

  const dayIds = dayRows.map((d) => d.id);
  const { data: mealRows } = await supabase
    .from("meal_plan_meals")
    .select(
      "plan_day_id, slot_index, name, recipe_title, calories, protein, carbs, fat, portion_multiplier, is_placeholder",
    )
    .in("plan_day_id", dayIds)
    .order("slot_index", { ascending: true });

  if (!mealRows) return null;

  const mealsByDay = new Map<string, MealPlanMealRow[]>();
  for (const m of mealRows as MealPlanMealRow[]) {
    const arr = mealsByDay.get(m.plan_day_id) ?? [];
    arr.push(m);
    mealsByDay.set(m.plan_day_id, arr);
  }

  const plans: DayPlan[] = dayRows.map((d) => {
    const meals = (mealsByDay.get(d.id) ?? [])
      .map((m) => ({
        name: m.name,
        recipeTitle: m.recipe_title,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        portionMultiplier: m.portion_multiplier,
        isPlaceholder: m.is_placeholder || undefined,
      }))
      .filter(
        (m) =>
          typeof m.recipeTitle === "string" &&
          !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }),
      );
    const totals = meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    return { day: d.day, meals, totals };
  });

  const anchorRaw = dayRows[0]?.start_date;
  const startDate =
    typeof anchorRaw === "string" && anchorRaw.length >= 10 ? anchorRaw.slice(0, 10) : null;

  return { plans, startDate };
}

export const ACTIVE_MEAL_PLAN_SLOT_STORAGE_KEY = "suppr-active-meal-plan-slot-v1";

/** AsyncStorage / localStorage key for the slot array (mobile hook). */
export const MEAL_PLAN_SLOTS_STORAGE_KEY = "suppr-meal-plan-slots-v1";

/** Default metadata JSON for new profiles. */
export function emptyMealPlanSlotsMetadata(): MealPlanSlotsMetadata {
  return { ...EMPTY_METADATA, slots: [] };
}
