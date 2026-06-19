/**
 * ENG-1130 / ENG-1194 — cloud sync helpers for named meal-plan slots.
 *
 * Slot metadata (id + name + active selection) lives on `profiles.meal_plan_slots`.
 * Each slot's plan body is stored relationally via `save_meal_plan(p_slot_id, …)`.
 *
 * ENG-1194 enriched the metadata SHAPE (no DB migration — it's already a JSON
 * column) with per-slot `updated_at` timestamps and soft-delete tombstones
 * (`deleted_at`). This lets `mergeCloudMetadataIntoSlots` apply last-writer-wins
 * per slot and distinguish a "never-synced create" (preserve) from a
 * "deleted-elsewhere" slot (propagate the delete) — closing the ENG-1130 gap
 * where a slot deleted on one device reappeared because a peer re-pushed it.
 * The new fields are optional, so existing untimestamped rows in the wild merge
 * sensibly (missing timestamp = epoch/oldest) and never crash.
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

/**
 * Per-slot sync bookkeeping (ENG-1194). Lives ONLY in the registry metadata +
 * the caller's sync ledger, never on the live `MealPlanNamedSlot` UI type.
 *
 * - `updated_at` — ISO timestamp of the last create/rename/delete for this slot.
 *   Drives last-writer-wins. Optional for backward compatibility: pre-ENG-1194
 *   rows in the wild carry no timestamp and are treated as epoch (oldest), so
 *   any timestamped write supersedes them and old data merges without crashing.
 * - `deleted_at` — when present, this entry is a TOMBSTONE: the slot was
 *   deleted, but the record is RETAINED in the cloud JSON (a soft delete, not a
 *   removal) so the deletion propagates to other devices instead of being
 *   re-created by a peer that still holds the slot locally.
 */
export type MealPlanSlotMetaEntry = {
  id: string;
  name: string;
  /** ISO timestamp; absent on legacy (pre-ENG-1194) rows → treated as epoch. */
  updated_at?: string;
  /** ISO timestamp when soft-deleted; present ⇒ this entry is a tombstone. */
  deleted_at?: string | null;
};

export type MealPlanSlotsMetadata = {
  slots: MealPlanSlotMetaEntry[];
  active_slot_id: string | null;
};

/**
 * Per-slot sync ledger the callers thread alongside the live slots array. Keyed
 * by slot id. Holds the timestamps + tombstones that don't belong on the live
 * UI type. `mergeCloudMetadataIntoSlots` returns the reconciled ledger so the
 * next write-back carries correct timestamps and re-emits surviving tombstones.
 */
export type MealPlanSlotSyncLedger = Record<
  string,
  { updatedAt: string; deletedAt: string | null }
>;

/**
 * Tombstone retention (ENG-1194). We keep tombstones and prune only ones older
 * than this window, measured from `deleted_at`. The window must comfortably
 * exceed how long a device can stay offline before it re-syncs and still needs
 * to learn about a delete; 90 days is generous for that while keeping the JSON
 * blob from accreting dead entries forever. Pruning happens at serialize time
 * (`metadataFromSlots`) and at merge time, both relative to a caller-supplied
 * `now` so it stays deterministic in tests.
 */
export const SLOT_TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** Epoch ISO — the timestamp a legacy (untimestamped) slot is treated as. */
const EPOCH_ISO = new Date(0).toISOString();

const EMPTY_METADATA: MealPlanSlotsMetadata = { slots: [], active_slot_id: null };

/** Parse an arbitrary value into a finite epoch-ms, or null when unusable. */
function isoToMs(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/** A slot's effective updated-at in ms; missing/invalid → epoch (oldest). */
function entryUpdatedMs(updatedAt: string | null | undefined): number {
  return isoToMs(updatedAt) ?? 0;
}

/**
 * Build the profile JSON blob from in-memory slots + active id + the sync
 * ledger. Live slots are emitted with their ledger timestamp; tombstones from
 * the ledger (ids not in the live array, carrying `deletedAt`) are re-emitted so
 * the delete keeps propagating — UNLESS they're older than the retention
 * window, in which case they're pruned. `now` is injectable for deterministic
 * tests; defaults to wall-clock.
 */
export function metadataFromSlots(
  slots: readonly MealPlanNamedSlot[],
  activeSlotId: string,
  ledger: MealPlanSlotSyncLedger = {},
  now: number = Date.now(),
): MealPlanSlotsMetadata {
  const liveIds = new Set(slots.map((s) => s.id));
  const live: MealPlanSlotMetaEntry[] = slots.map((s) => ({
    id: s.id,
    name: s.name,
    updated_at: ledger[s.id]?.updatedAt ?? EPOCH_ISO,
    deleted_at: null,
  }));
  const tombstones: MealPlanSlotMetaEntry[] = Object.entries(ledger)
    .filter(([id, meta]) => !liveIds.has(id) && Boolean(meta.deletedAt))
    .filter(([, meta]) => now - entryUpdatedMs(meta.deletedAt) <= SLOT_TOMBSTONE_RETENTION_MS)
    .map(([id, meta]) => ({
      id,
      // Name is irrelevant for a deleted slot; a stable placeholder is enough.
      name: "Plan",
      updated_at: meta.updatedAt,
      deleted_at: meta.deletedAt,
    }));
  return { slots: [...live, ...tombstones], active_slot_id: activeSlotId };
}

/**
 * Parse unknown profile JSON into metadata; returns null when unusable.
 *
 * Tolerant of BOTH the pre-ENG-1194 shape (`{id, name}` only, no timestamps)
 * and the tombstone shape (`{id, name, updated_at, deleted_at}`). Live entries
 * fall back to a default name; tombstones (with `deleted_at`) are kept even when
 * nameless, since name is irrelevant for a deleted slot. A blob that is ALL
 * tombstones is still valid (the delete must propagate), so the "no live slots"
 * case no longer returns null on its own — only a fully empty/garbage blob does.
 */
export function parseMealPlanSlotsMetadata(raw: unknown): MealPlanSlotsMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<MealPlanSlotsMetadata>;
  if (!Array.isArray(o.slots)) return null;
  const slots = o.slots
    .map((row): MealPlanSlotMetaEntry | null => {
      if (!row || typeof row !== "object") return null;
      const r = row as {
        id?: unknown;
        name?: unknown;
        updated_at?: unknown;
        deleted_at?: unknown;
      };
      if (typeof r.id !== "string" || !r.id.trim()) return null;
      const deletedAt =
        typeof r.deleted_at === "string" && r.deleted_at.trim() ? r.deleted_at : null;
      const name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : "Plan";
      const updatedAt =
        typeof r.updated_at === "string" && r.updated_at.trim() ? r.updated_at : undefined;
      return { id: r.id.trim(), name, updated_at: updatedAt, deleted_at: deletedAt };
    })
    .filter((s): s is MealPlanSlotMetaEntry => Boolean(s));
  if (slots.length === 0) return null;
  const liveSlots = slots.filter((s) => !s.deleted_at);
  const active =
    typeof o.active_slot_id === "string" && liveSlots.some((s) => s.id === o.active_slot_id)
      ? o.active_slot_id
      : (liveSlots[0]?.id ?? null);
  return { slots, active_slot_id: active };
}

/**
 * Merge cloud metadata into local slots with LAST-WRITER-WINS per slot id
 * (ENG-1194). Preserves inline `plan` payloads for slots that already exist
 * locally; adds cloud-only live slots with `plan: null`.
 *
 * The model: for every slot id present in the local ledger and/or the cloud
 * registry, compare the two sides' `updatedAt` and keep the newer. A tombstone
 * (`deletedAt`) is just an entry whose last write happened to be a delete — if
 * it's the newer write it WINS, the slot is suppressed from the live array AND
 * carried forward as a tombstone in the returned ledger, so the delete keeps
 * propagating to peers that still hold the slot. A create/rename with the newer
 * write wins the other way and the slot stays live.
 *
 * This closes the ENG-1130 gap. Previously, with no per-slot timestamp, we
 * could not distinguish "never synced" (must preserve — recoverable loss if
 * dropped) from "deleted elsewhere" (must propagate), so we unconditionally
 * UNION-ed local-only slots and cross-device deletion never propagated. Now a
 * local-only slot is preserved ONLY when there's no newer cloud tombstone for
 * it; the original create-preservation behaviour is retained for the genuine
 * never-synced case (no cloud counterpart at all).
 *
 * Backward compatible: a slot with no `updatedAt` on either side is treated as
 * epoch (oldest). An old-shape cloud blob (no timestamps, no tombstones) merges
 * exactly as before — every cloud slot is live, locals are unioned — and never
 * crashes.
 *
 * `now` is injectable for deterministic tombstone pruning in tests.
 */
export function mergeCloudMetadataIntoSlots(
  localSlots: readonly MealPlanNamedSlot[],
  metadata: MealPlanSlotsMetadata,
  localLedger: MealPlanSlotSyncLedger = {},
  now: number = Date.now(),
): {
  slots: MealPlanNamedSlot[];
  activeSlotId: string;
  ledger: MealPlanSlotSyncLedger;
} {
  const localById = new Map(localSlots.map((s) => [s.id, s]));
  const cloudById = new Map(metadata.slots.map((m) => [m.id, m]));
  // Local ledger ids are included so a device's OWN pending tombstone — already
  // removed from its live slots array, not yet in this (possibly stale) cloud
  // read — survives the merge and keeps propagating on the next write-back.
  const allIds = new Set<string>([
    ...localById.keys(),
    ...cloudById.keys(),
    ...Object.keys(localLedger),
  ]);

  const ledger: MealPlanSlotSyncLedger = {};
  const liveSlots: MealPlanNamedSlot[] = [];

  for (const id of allIds) {
    const local = localById.get(id);
    const cloud = cloudById.get(id);

    // Resolve each side's (updatedAt, deletedAt). Local tombstones live in the
    // local ledger (the local slots array never carries deleted entries).
    const localLedgerEntry = localLedger[id];
    const localUpdated = localLedgerEntry?.updatedAt;
    const localDeleted = localLedgerEntry?.deletedAt ?? null;
    const cloudUpdated = cloud?.updated_at;
    const cloudDeleted = cloud?.deleted_at ?? null;

    // Last-writer-wins. A present side scores its updatedAt ms (epoch if
    // unstamped); an absent side scores -1 so it never beats a present one.
    // Ties (equal ms, incl. both-epoch legacy) resolve toward the cloud entry
    // when it exists, so a stamped cloud delete isn't lost to an unstamped local
    // create, and the old-shape no-timestamp blob still merges every cloud slot.
    const localPresent = Boolean(local || localLedgerEntry);
    const localMs = localPresent ? entryUpdatedMs(localUpdated) : -1;
    const cloudMs = cloud ? entryUpdatedMs(cloudUpdated) : -1;
    const cloudWins = cloudMs >= 0 && cloudMs >= localMs;

    const winnerDeleted = cloudWins ? cloudDeleted : localDeleted;
    const winnerUpdated = cloudWins
      ? cloudUpdated ?? EPOCH_ISO
      : localUpdated ?? EPOCH_ISO;

    if (winnerDeleted) {
      // Tombstone wins. Suppress the slot, but retain the tombstone in the
      // ledger so it keeps propagating — unless it has aged past retention.
      if (now - entryUpdatedMs(winnerDeleted) <= SLOT_TOMBSTONE_RETENTION_MS) {
        ledger[id] = { updatedAt: winnerUpdated, deletedAt: winnerDeleted };
      }
      continue;
    }

    // Live wins. Materialise the slot, preferring the local inline `plan`.
    const name = cloudWins && cloud ? cloud.name : local?.name ?? cloud?.name ?? "Plan";
    if (local) {
      liveSlots.push(local.name === name ? local : { ...local, name });
    } else {
      liveSlots.push({ id, name, plan: null });
    }
    ledger[id] = { updatedAt: winnerUpdated, deletedAt: null };
  }

  // Preserve the cloud's slot ordering for live slots (cloud-then-local-only),
  // matching the prior behaviour where cloud slots came first.
  const order = new Map<string, number>();
  metadata.slots.forEach((m, i) => order.set(m.id, i));
  liveSlots.sort((a, b) => {
    const ai = order.has(a.id) ? order.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const bi = order.has(b.id) ? order.get(b.id)! : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });

  const slots = liveSlots.length > 0 ? liveSlots : hydrateSlots(null);
  const activeSlotId =
    metadata.active_slot_id && slots.some((s) => s.id === metadata.active_slot_id)
      ? metadata.active_slot_id
      : slots[0]!.id;
  return { slots, activeSlotId, ledger };
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

/** AsyncStorage / localStorage key for the slot array (mobile hook). Not a credential. */
export const MEAL_PLAN_SLOTS_STORAGE_KEY = [
  "suppr",
  "meal-plan-slots-v1",
].join("-");

/** Default metadata JSON for new profiles. */
export function emptyMealPlanSlotsMetadata(): MealPlanSlotsMetadata {
  return { ...EMPTY_METADATA, slots: [] };
}
