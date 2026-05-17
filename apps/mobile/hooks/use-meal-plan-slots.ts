import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_MEAL_PLAN_SLOT_ID,
  activePlanFromSlots,
  createSlot,
  deleteSlot,
  hydrateSlots,
  makeDefaultSlot,
  renameSlot,
  setActiveSlotPlan,
  type MealPlanNamedSlot,
} from "@suppr/shared/mealPlan/namedSlots";
import type { DayPlan } from "../../../src/types/recipe";

/**
 * Mobile parity for web's named meal-plan slots
 * (`src/context/AppDataContext.tsx` `mealPlanSlots`).
 *
 * Web uses localStorage; mobile uses AsyncStorage. Both sides share
 * the pure CRUD helpers in `src/lib/mealPlan/namedSlots.ts` so the
 * data shape and rules can never drift. The cloud syncs only the
 * **active plan** via `upsertMealPlanJson` — slot names + ids stay
 * device-local on both platforms.
 *
 * Storage keys are versioned (`-v1`) so a future schema change can
 * write to `-v2` and leave old data untouched until the migrator
 * runs.
 */

const SLOTS_STORAGE_KEY = "suppr-meal-plan-slots-v1";
const ACTIVE_SLOT_STORAGE_KEY = "suppr-active-meal-plan-slot-v1";

export interface UseMealPlanSlotsResult {
  slots: MealPlanNamedSlot[];
  activeSlotId: string;
  /** True until the first AsyncStorage hydrate completes. While true,
   *  the slots array is the synthetic default — don't persist
   *  generated plans yet. */
  hydrating: boolean;
  /** Active slot's plan, or null if not yet generated. Mirrors
   *  `useState<DayPlan[] | null>` so existing callers can drop this
   *  in without changing state shape. */
  activePlan: DayPlan[] | null;
  /** Replace the active slot's plan (or update via fn). Persists. */
  setActivePlan: (next: DayPlan[] | null | ((prev: DayPlan[] | null) => DayPlan[] | null)) => void;
  /** Switch active slot. No-op if `slotId` doesn't exist. */
  switchSlot: (slotId: string) => void;
  /** Create a new slot, switch to it, return its id. Capped at
   *  `MAX_MEAL_PLAN_SLOTS` (silently no-op when cap reached). */
  createNewSlot: (name: string) => string;
  /** Rename an existing slot. */
  renameExistingSlot: (slotId: string, name: string) => void;
  /** Delete a slot. Refuses to delete the last remaining slot. When
   *  the deleted slot is active, switches to the first remaining. */
  deleteExistingSlot: (slotId: string) => void;
}

export function useMealPlanSlots(initialPlan: DayPlan[] | null = null): UseMealPlanSlotsResult {
  const [slots, setSlots] = useState<MealPlanNamedSlot[]>(() => [makeDefaultSlot(initialPlan)]);
  const [activeSlotId, setActiveSlotId] = useState<string>(DEFAULT_MEAL_PLAN_SLOT_ID);
  const [hydrating, setHydrating] = useState(true);

  // Refs to avoid re-running the hydrate effect on slot mutations.
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const activeRef = useRef(activeSlotId);
  activeRef.current = activeSlotId;

  // Hydrate from AsyncStorage on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [slotsRaw, activeRaw] = await Promise.all([
          AsyncStorage.getItem(SLOTS_STORAGE_KEY),
          AsyncStorage.getItem(ACTIVE_SLOT_STORAGE_KEY),
        ]);
        if (cancelled) return;
        const parsed = slotsRaw ? safeParse(slotsRaw) : null;
        const hydrated = hydrateSlots(parsed, initialPlan);
        const next =
          activeRaw && hydrated.some((s) => s.id === activeRaw)
            ? activeRaw
            : hydrated[0]!.id;
        setSlots(hydrated);
        setActiveSlotId(next);
      } catch {
        // AsyncStorage occasionally throws on cold start — fall back
        // to the synthetic default and let the next mutation persist.
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // initialPlan is captured once on first mount; later changes don't
    // re-hydrate because that would clobber user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist slots whenever they change post-hydration.
  useEffect(() => {
    if (hydrating) return;
    void AsyncStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify(slots)).catch(() => {});
  }, [slots, hydrating]);

  // Persist active slot id.
  useEffect(() => {
    if (hydrating) return;
    void AsyncStorage.setItem(ACTIVE_SLOT_STORAGE_KEY, activeSlotId).catch(() => {});
  }, [activeSlotId, hydrating]);

  const setActivePlan = useCallback<UseMealPlanSlotsResult["setActivePlan"]>((next) => {
    setSlots((prev) => {
      const currentPlan = activePlanFromSlots(prev, activeRef.current);
      const nextPlan =
        typeof next === "function"
          ? (next as (p: DayPlan[] | null) => DayPlan[] | null)(currentPlan)
          : next;
      return setActiveSlotPlan(prev, activeRef.current, nextPlan);
    });
  }, []);

  const switchSlot = useCallback<UseMealPlanSlotsResult["switchSlot"]>((slotId) => {
    if (!slotsRef.current.some((s) => s.id === slotId)) return;
    setActiveSlotId(slotId);
  }, []);

  const createNewSlot = useCallback<UseMealPlanSlotsResult["createNewSlot"]>((name) => {
    const result = createSlot(slotsRef.current, name);
    setSlots(result.slots);
    setActiveSlotId(result.id);
    return result.id;
  }, []);

  const renameExistingSlot = useCallback<UseMealPlanSlotsResult["renameExistingSlot"]>(
    (slotId, name) => {
      setSlots((prev) => renameSlot(prev, slotId, name));
    },
    [],
  );

  const deleteExistingSlot = useCallback<UseMealPlanSlotsResult["deleteExistingSlot"]>(
    (slotId) => {
      const result = deleteSlot(slotsRef.current, slotId, activeRef.current);
      setSlots(result.slots);
      if (result.activeId !== activeRef.current) setActiveSlotId(result.activeId);
    },
    [],
  );

  const activePlan = activePlanFromSlots(slots, activeSlotId);

  return {
    slots,
    activeSlotId,
    hydrating,
    activePlan,
    setActivePlan,
    switchSlot,
    createNewSlot,
    renameExistingSlot,
    deleteExistingSlot,
  };
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
