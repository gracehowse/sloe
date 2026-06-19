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
import {
  fetchMealPlanForLocalSlot,
  mergeCloudMetadataIntoSlots,
  metadataFromSlots,
  parseMealPlanSlotsMetadata,
  ACTIVE_MEAL_PLAN_SLOT_STORAGE_KEY,
  MEAL_PLAN_SLOTS_STORAGE_KEY,
  type MealPlanSlotSyncLedger,
} from "@suppr/shared/mealPlan/slotCloudSync";
import { supabase } from "@/lib/supabase";
import type { DayPlan } from "../../../src/types/recipe";

/**
 * Mobile parity for web's named meal-plan slots
 * (`src/context/AppDataContext.tsx` `mealPlanSlots`).
 *
 * Web uses localStorage; mobile uses AsyncStorage. Both sides share
 * the pure CRUD helpers in `src/lib/mealPlan/namedSlots.ts` so the
 * data shape and rules can never drift. ENG-1130 syncs slot metadata
 * (ids, names, active selection) to `profiles.meal_plan_slots`; each
 * slot's plan body is stored via `save_meal_plan(p_slot_id, …)`.
 * ENG-1194 adds a per-slot sync ledger (`ledgerRef`) carrying `updatedAt`
 * timestamps + soft-delete tombstones so cross-device deletes propagate
 * (last-writer-wins per slot) instead of a peer resurrecting a deleted slot.
 *
 * Storage keys are versioned (`-v1`) so a future schema change can
 * write to `-v2` and leave old data untouched until the migrator
 * runs.
 */

const SLOTS_STORAGE_KEY = MEAL_PLAN_SLOTS_STORAGE_KEY;
const ACTIVE_SLOT_STORAGE_KEY = ACTIVE_MEAL_PLAN_SLOT_STORAGE_KEY;

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

export function useMealPlanSlots(
  initialPlan: DayPlan[] | null = null,
  options?: { userId?: string | null },
): UseMealPlanSlotsResult {
  const userId = options?.userId ?? null;
  const [slots, setSlots] = useState<MealPlanNamedSlot[]>(() => [makeDefaultSlot(initialPlan)]);
  const [activeSlotId, setActiveSlotId] = useState<string>(DEFAULT_MEAL_PLAN_SLOT_ID);
  const [hydrating, setHydrating] = useState(true);

  // Refs to avoid re-running the hydrate effect on slot mutations.
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const activeRef = useRef(activeSlotId);
  activeRef.current = activeSlotId;
  const cloudMetadataLoadedRef = useRef(false);
  // ENG-1194: per-slot sync ledger (updatedAt + tombstones). Held in a ref —
  // it never drives render, only the cloud metadata write-back + merge. Stamped
  // on every create/rename/delete; reconciled by the cloud merge.
  const ledgerRef = useRef<MealPlanSlotSyncLedger>({});
  const stampSlot = useCallback((slotId: string, deleted: boolean) => {
    const nowIso = new Date().toISOString();
    ledgerRef.current = {
      ...ledgerRef.current,
      [slotId]: { updatedAt: nowIso, deletedAt: deleted ? nowIso : null },
    };
  }, []);

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

  // ENG-1130 — merge slot registry from profiles after local hydrate.
  useEffect(() => {
    if (!userId || hydrating) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("meal_plan_slots")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      const cloudMeta = parseMealPlanSlotsMetadata(
        (data as { meal_plan_slots?: unknown } | null)?.meal_plan_slots,
      );
      if (cloudMeta) {
        // ENG-1194: merge once (last-writer-wins per slot), then apply slots +
        // active + reconciled ledger so tombstones survive into the next write.
        const merged = mergeCloudMetadataIntoSlots(
          slotsRef.current,
          cloudMeta,
          ledgerRef.current,
        );
        ledgerRef.current = merged.ledger;
        setSlots(merged.slots);
        if (merged.activeSlotId) setActiveSlotId(merged.activeSlotId);
      }
      cloudMetadataLoadedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, hydrating]);

  // When signed out, allow the next sign-in to re-hydrate cloud metadata.
  useEffect(() => {
    if (!userId) cloudMetadataLoadedRef.current = false;
  }, [userId]);

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

  // ENG-1130 — sync slot registry metadata to profiles.
  useEffect(() => {
    if (!userId || hydrating || !cloudMetadataLoadedRef.current) return;
    const t = setTimeout(async () => {
      const payload = metadataFromSlots(
        slotsRef.current,
        activeRef.current,
        ledgerRef.current, // ENG-1194: carry timestamps + tombstones.
      );
      await supabase.from("profiles").update({ meal_plan_slots: payload }).eq("id", userId);
    }, 600);
    return () => clearTimeout(t);
  }, [userId, slots, activeSlotId, hydrating]);

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
    if (!userId) return;
    const target = slotsRef.current.find((s) => s.id === slotId);
    if (target?.plan) return;
    void (async () => {
      const loaded = await fetchMealPlanForLocalSlot(supabase, userId, slotId);
      if (!loaded?.plans.length) return;
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, plan: loaded.plans } : s)),
      );
    })();
  }, [userId]);

  const createNewSlot = useCallback<UseMealPlanSlotsResult["createNewSlot"]>((name) => {
    const result = createSlot(slotsRef.current, name);
    // createSlot returns the first slot id when at cap (no append) — only stamp
    // when a genuinely new slot was added.
    if (result.slots.length > slotsRef.current.length) {
      stampSlot(result.id, false); // ENG-1194: timestamp the create.
    }
    setSlots(result.slots);
    setActiveSlotId(result.id);
    return result.id;
  }, [stampSlot]);

  const renameExistingSlot = useCallback<UseMealPlanSlotsResult["renameExistingSlot"]>(
    (slotId, name) => {
      if (name.trim() && slotsRef.current.some((s) => s.id === slotId)) {
        stampSlot(slotId, false); // ENG-1194: timestamp the rename.
      }
      setSlots((prev) => renameSlot(prev, slotId, name));
    },
    [stampSlot],
  );

  const deleteExistingSlot = useCallback<UseMealPlanSlotsResult["deleteExistingSlot"]>(
    (slotId) => {
      const result = deleteSlot(slotsRef.current, slotId, activeRef.current);
      // deleteSlot is a no-op for the last remaining slot / unknown id — only
      // tombstone when a slot was actually removed.
      if (result.slots.length < slotsRef.current.length) {
        stampSlot(slotId, true); // ENG-1194: tombstone the delete.
      }
      setSlots(result.slots);
      if (result.activeId !== activeRef.current) setActiveSlotId(result.activeId);
    },
    [stampSlot],
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
