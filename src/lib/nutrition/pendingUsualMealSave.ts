/**
 * Pending "save your usual" deep-link (post-ship #4, 2026-04-18).
 *
 * Bridges the weekly-recap card (rendered on Progress) with the Save
 * Usual Meal dialog (owned by Today / `NutritionTracker` on web,
 * `(tabs)/index.tsx` on mobile). When the user taps the recap prompt
 * CTA we:
 *
 *   1. Compute the pre-seed via `selectMostFrequentSlotSeed(byDay)`.
 *   2. Stash `{slot, items}` under the versioned storage key below.
 *   3. Route the user to Today.
 *
 * On arrival, the Today host checks for a pending request and, if
 * present, pops it and opens the save dialog pre-seeded with the
 * stashed items. A short TTL (5 minutes) stops an orphaned request
 * from firing on a stale reload — if the user never actually lands on
 * Today we'd rather show nothing than a random dialog.
 *
 * Pure — no React, no platform APIs. The web side consumes this via
 * `window.sessionStorage`; the mobile side consumes the same shape via
 * `AsyncStorage`. Keeping the serialisation here means the two
 * platforms cannot drift on payload shape or TTL.
 */

import type { SavedMealItem } from "./savedMeals";

/** Versioned key — bump when the payload shape changes so a stale
 *  blob from an older build never deserialises wrong. */
export const PENDING_USUAL_MEAL_SAVE_KEY = "suppr-pending-usual-meal-save-v1";

/** 5-minute TTL. A user who taps Progress → recap → "Save Breakfast"
 *  should always land within this window; anything longer suggests
 *  the app was backgrounded or deep-linked elsewhere. */
export const PENDING_USUAL_MEAL_SAVE_TTL_MS = 5 * 60_000;

const ALLOWED_SLOTS = new Set(["Breakfast", "Lunch", "Dinner", "Snacks"]);
type Slot = "Breakfast" | "Lunch" | "Dinner" | "Snacks";

export type PendingUsualMealSave = {
  slot: Slot;
  items: Array<Omit<SavedMealItem, "id" | "position">>;
  /** Epoch ms when the request was stashed. Used by `parsePendingUsualMealSave` to enforce the TTL. */
  createdAt: number;
};

/** Build the serialised JSON blob stored under `PENDING_USUAL_MEAL_SAVE_KEY`.
 *  The caller is responsible for handing this to `sessionStorage` (web)
 *  or `AsyncStorage` (mobile). `createdAt` defaults to `Date.now()` but
 *  is injectable for unit-testability. */
export function serializePendingUsualMealSave(
  slot: string,
  items: Array<Omit<SavedMealItem, "id" | "position">>,
  now: number = Date.now(),
): string | null {
  if (!ALLOWED_SLOTS.has(slot)) return null;
  if (!Array.isArray(items) || items.length < 2) return null;
  const payload: PendingUsualMealSave = {
    slot: slot as Slot,
    items,
    createdAt: now,
  };
  try {
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}

/** Parse a stored blob back into a typed payload. Returns `null` when:
 *   - the raw string is missing or invalid JSON, OR
 *   - the payload is shape-wrong (bad slot / empty items), OR
 *   - the TTL has expired (`now - createdAt > PENDING_USUAL_MEAL_SAVE_TTL_MS`).
 *
 *  Callers should clear the storage key after reading regardless of
 *  the return value — an expired blob shouldn't live forever. */
export function parsePendingUsualMealSave(
  raw: string | null | undefined,
  now: number = Date.now(),
): PendingUsualMealSave | null {
  if (typeof raw !== "string" || !raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (!ALLOWED_SLOTS.has(String(p.slot))) return null;
  if (!Array.isArray(p.items) || p.items.length < 2) return null;
  const createdAt = typeof p.createdAt === "number" ? p.createdAt : 0;
  if (now - createdAt > PENDING_USUAL_MEAL_SAVE_TTL_MS) return null;
  // Narrow items — we only keep rows that look like a save payload.
  const items: Array<Omit<SavedMealItem, "id" | "position">> = [];
  for (const raw of p.items) {
    if (!raw || typeof raw !== "object") continue;
    const it = raw as Record<string, unknown>;
    if (typeof it.recipeTitle !== "string") continue;
    const row: Omit<SavedMealItem, "id" | "position"> = {
      recipeTitle: it.recipeTitle,
      calories: Number(it.calories) || 0,
      protein: Number(it.protein) || 0,
      carbs: Number(it.carbs) || 0,
      fat: Number(it.fat) || 0,
    };
    if (typeof it.fiber === "number") row.fiber = it.fiber;
    if (typeof it.waterMl === "number") row.waterMl = it.waterMl;
    if (typeof it.portionMultiplier === "number") row.portionMultiplier = it.portionMultiplier;
    if (typeof it.source === "string") row.source = it.source;
    items.push(row);
  }
  if (items.length < 2) return null;
  return { slot: p.slot as Slot, items, createdAt };
}
