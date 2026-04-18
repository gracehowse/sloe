/**
 * Usual-meal hint gate (Ship M1) — shared helper deciding whether the
 * first-run "Make this your usual {slot}" hint should surface inside a
 * meal-slot on Today.
 *
 * Saved meals ("usual meals") is the canonical re-log mechanism. The hint
 * is a one-off nudge that teaches users the surface exists, fired once
 * per slot per device and then retired forever.
 *
 * Gate rule (either signal is enough):
 *   1. Same-day signal — user has logged ≥2 items into `slot` on the
 *      current day. They clearly have a combo; we prompt them to name it.
 *   2. Cross-day signal — the same item (by `normaliseRecipeTitle` +
 *      round-calories) has been logged into `slot` on ≥2 distinct days in
 *      the last 7 days. Strong "usual" signal even with a single item per
 *      day.
 *
 * Gate negatives:
 *   - User already has a saved meal whose `defaultMealSlot` matches this
 *     slot — they know about the feature, stop nagging.
 *   - User has dismissed the hint for this slot (persisted by the caller
 *     under a versioned key).
 *   - There are zero items logged in the slot today (no items = nothing
 *     to save).
 *
 * No React, no storage, no network. Callers pass in what they already
 * have in state and the dismissed-slots set they pulled from storage.
 * Both web (`localStorage`) and mobile (`AsyncStorage`) consume this
 * file — all persistence happens in the caller.
 *
 * Persistence key (shared):
 *   `suppr-usual-meal-hint-dismissed-v1` → comma-separated slots
 *   (`"Breakfast,Snacks"`). Empty string for "none dismissed yet".
 */

import { normaliseMealSlot, type MealSlot } from "./mealSlots";
import { computeFrequentMeals, type FoodHistoryItem, type FoodHistoryMealLike } from "./foodHistory";

/**
 * Minimal shape we need from a journal meal. Accepts both the web
 * `LoggedMeal` and the mobile `JournalMeal` — callers pass their byDay
 * map directly.
 */
export type UsualMealHintMealLike = {
  /** Meal slot the row was logged into ("Breakfast" / "Lunch" / ...). */
  name?: string | null;
  recipeTitle?: string | null;
  calories?: number | null;
};

export type UsualMealHintInput = {
  /** Journal map keyed by `YYYY-MM-DD`. */
  byDay: Record<string, UsualMealHintMealLike[]>;
  /** Slot we're deciding the hint for. */
  slot: MealSlot;
  /** Today's local-date key (`YYYY-MM-DD`). */
  todayKey: string;
  /** Slots the user has previously dismissed the hint in. */
  dismissedSlots: ReadonlySet<string>;
  /**
   * Slots that already have at least one saved meal with matching
   * `defaultMealSlot`. When the user already has a usual meal for this
   * slot, we don't need to teach them the feature.
   */
  savedMealSlots?: ReadonlySet<string>;
};

/** Persistence key (versioned). Exported so callers don't hand-type it. */
export const USUAL_MEAL_HINT_STORAGE_KEY = "suppr-usual-meal-hint-dismissed-v1";

const SLOT_SET = new Set<MealSlot>(["Breakfast", "Lunch", "Dinner", "Snacks"]);

function isValidSlot(slot: unknown): slot is MealSlot {
  return typeof slot === "string" && SLOT_SET.has(slot as MealSlot);
}

/**
 * Normalise a recipe title for cross-day "same item" matching. Lower-case,
 * trim, collapse whitespace. Enough to match "Oatmeal" vs "oatmeal " on
 * two different days; not trying to be smart about spelling variants.
 */
export function normaliseRecipeTitle(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Round kcal to the nearest integer, defensively. */
function roundCal(raw: number | null | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.round(raw);
}

/**
 * Number of unique (YYYY-MM-DD) days in the last 7 (inclusive of today)
 * where `(title, calories)` was logged into `slot`. `todayKey` is passed
 * in so tests don't need to monkeypatch `Date`.
 */
function crossDayMatches(
  byDay: Record<string, UsualMealHintMealLike[]>,
  slot: MealSlot,
  todayKey: string,
): Map<string, Set<string>> {
  // Build the 7-day window ending today.
  const windowKeys = sevenDayWindow(todayKey);
  // Key: `${title}|${calories}` → Set of distinct day keys where it appeared.
  const matches = new Map<string, Set<string>>();
  for (const dayKey of windowKeys) {
    const meals = byDay[dayKey] ?? [];
    for (const m of meals) {
      if (normaliseMealSlot(m?.name ?? "") !== slot) continue;
      const title = normaliseRecipeTitle(m?.recipeTitle);
      if (!title) continue;
      const key = `${title}|${roundCal(m?.calories)}`;
      const set = matches.get(key) ?? new Set<string>();
      set.add(dayKey);
      matches.set(key, set);
    }
  }
  return matches;
}

/**
 * Build a list of date-keys for the seven-day window ending on `todayKey`
 * (inclusive). Parses `todayKey` as a local date — if it is malformed we
 * return a one-element array so the cross-day check degrades gracefully.
 */
function sevenDayWindow(todayKey: string): string[] {
  const parts = todayKey.split("-");
  if (parts.length !== 3) return [todayKey];
  const [y, m, d] = parts.map((n) => Number.parseInt(n, 10));
  if (![y, m, d].every((n) => Number.isFinite(n))) return [todayKey];
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - i);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    out.push(`${yy}-${mm}-${dd}`);
  }
  return out;
}

/**
 * Decide whether to show the usual-meal hint inside `slot` right now.
 *
 * Returns `true` only when:
 *   - `slot` is a canonical meal slot ("Breakfast"/…).
 *   - The user has **not** already dismissed this slot's hint.
 *   - The user does **not** already own a saved meal with this default slot.
 *   - Today's slot has at least one item (empty slot = no signal, no hint).
 *   - EITHER today's slot has ≥2 items OR the same (title, kcal) has been
 *     logged in this slot on ≥2 distinct days in the last 7 days.
 */
export function shouldShowUsualMealHint(input: UsualMealHintInput): boolean {
  if (!isValidSlot(input.slot)) return false;
  if (input.dismissedSlots.has(input.slot)) return false;
  if (input.savedMealSlots?.has(input.slot)) return false;

  const todaysSlotMeals = (input.byDay[input.todayKey] ?? []).filter(
    (m) => normaliseMealSlot(m?.name ?? "") === input.slot,
  );
  // No items logged today in this slot → nothing concrete to save,
  // even if cross-day history exists (the CTA would seed empty items).
  if (todaysSlotMeals.length === 0) return false;

  // Same-day signal — two or more items in this slot today.
  if (todaysSlotMeals.length >= 2) return true;

  // Cross-day signal — the same item across ≥2 distinct days in 7d.
  const matches = crossDayMatches(input.byDay, input.slot, input.todayKey);
  for (const days of matches.values()) {
    if (days.size >= 2) return true;
  }
  return false;
}

/**
 * Serialise / parse the dismissed-slots set for the versioned storage
 * key. Comma-separated for readability; invalid entries silently dropped
 * so a future slot rename does not brick the key.
 */
export function serializeDismissedSlots(set: ReadonlySet<string>): string {
  const slots: MealSlot[] = [];
  for (const s of set) {
    if (isValidSlot(s)) slots.push(s);
  }
  return slots.join(",");
}

export function parseDismissedSlots(raw: string | null | undefined): Set<MealSlot> {
  const out = new Set<MealSlot>();
  if (typeof raw !== "string" || raw.length === 0) return out;
  for (const piece of raw.split(",")) {
    const s = piece.trim();
    if (isValidSlot(s)) out.add(s);
  }
  return out;
}

/** Tab identifiers used by both the web and mobile Quick Add panel. Kept
 * here so the default-tab rule is enforceable in a single pure helper. */
export type QuickAddTabId = "saved" | "recent" | "frequent" | "favourites";

/**
 * Default tab resolution (Ship M1, 2026-04-18).
 *
 * Saved meals is the canonical re-log surface, so any user who has at
 * least one saved meal lands on the "Usual meals" tab first. Users with
 * no saved meals yet land on Recent so they still see history on open.
 *
 * Shared by web `quick-add-panel.tsx` and mobile `QuickAddPanel.tsx` so
 * the two platforms cannot drift on first-impression logic.
 */
export function resolveQuickAddDefaultTab(hasSavedMeals: boolean): QuickAddTabId {
  return hasSavedMeals ? "saved" : "recent";
}

/**
 * Post-ship #4 (2026-04-18) — pre-seed payload for the weekly-recap
 * "Save your usual" deep-link.
 *
 * When the user taps the recap-card prompt CTA we don't want to bounce
 * them to Today and make them find the slot-header save row. Instead we
 * open `SaveMealDialog` (web) / `SaveMealSheet` (mobile) pre-seeded with
 * the user's actual most-frequent items in the strongest slot across
 * their whole history. The dialog already supports `seedItems` — this
 * helper decides **which** items and **which** slot to pass.
 *
 * Rules:
 *  - Only items the user has actually logged. Never invent rows.
 *  - An item qualifies for the seed when its (title, round-kcal) bucket
 *    appears on ≥2 distinct days in the slot (`MIN_ITEM_COUNT`). This is
 *    the "you eat this repeatedly" signal — the whole point of the
 *    growth loop. A one-off Tuesday-lunch shouldn't end up in a "usual
 *    lunch" combo.
 *  - A slot qualifies when it has ≥2 qualifying items (`MIN_SEED_ITEMS`).
 *    Below that threshold there's nothing to "combo".
 *  - Up to 4 items are returned per seed (`MAX_SEED_ITEMS`) ordered by
 *    count desc, then most-recent tie-break, then title — same order as
 *    `computeFrequentMeals`.
 *  - `slotPreference` (usually the insight's `suggestedSlot`) wins when
 *    it qualifies; otherwise the slot with the strongest signal wins.
 *    Signal = sum of top-4 qualifying item counts; slot-ordering
 *    (Breakfast < Lunch < Dinner < Snacks) breaks final ties
 *    deterministically so the same `byDay` always returns the same slot.
 *  - Returns `null` when no slot qualifies — callers fall back to
 *    routing the user to Today rather than opening an empty dialog.
 */

const MIN_ITEM_COUNT = 2;
const MIN_SEED_ITEMS = 2;
const MAX_SEED_ITEMS = 4;

export type SelectMostFrequentSlotSeedResult = {
  slot: MealSlot;
  seedItems: FoodHistoryItem[];
};

export function selectMostFrequentSlotSeed<M extends FoodHistoryMealLike & { name?: string | null }>(
  byDay: Record<string, M[]>,
  slotPreference?: string | null,
): SelectMostFrequentSlotSeedResult | null {
  if (!byDay || typeof byDay !== "object") return null;

  // Build a per-slot `byDay` slice so `computeFrequentMeals` can bucket
  // items without mixing slots. We rebuild per slot rather than grouping
  // once so legacy rows (e.g. `"Snack"` vs `"Snacks"`) collapse via
  // `normaliseMealSlot` — identical to the gate rules in
  // `shouldShowUsualMealHint`.
  const slots: readonly MealSlot[] = ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const perSlotItems = new Map<MealSlot, FoodHistoryItem[]>();
  for (const slot of slots) {
    const slotByDay: Record<string, M[]> = {};
    for (const [dayKey, meals] of Object.entries(byDay)) {
      if (!Array.isArray(meals)) continue;
      const kept = meals.filter((m) => normaliseMealSlot(m?.name ?? "") === slot);
      if (kept.length > 0) slotByDay[dayKey] = kept;
    }
    // `computeFrequentMeals` already sorts by count desc, most-recent
    // tie-break, then title — exactly what we want for the seed.
    const ranked = computeFrequentMeals(slotByDay, 20);
    const qualifying = ranked.filter((it) => it.count >= MIN_ITEM_COUNT);
    if (qualifying.length >= MIN_SEED_ITEMS) {
      perSlotItems.set(slot, qualifying.slice(0, MAX_SEED_ITEMS));
    }
  }

  if (perSlotItems.size === 0) return null;

  // Slot-preference path — honour the caller's hint when it qualifies.
  const preferred = normaliseMealSlot(slotPreference ?? null);
  if (preferred && perSlotItems.has(preferred)) {
    return { slot: preferred, seedItems: perSlotItems.get(preferred)! };
  }

  // Auto-pick the slot with the strongest signal = sum of kept-item
  // counts. Deterministic tie-break by canonical slot order so two
  // equally-strong slots always resolve to the same one across renders.
  let bestSlot: MealSlot | null = null;
  let bestSignal = -1;
  for (const slot of slots) {
    const items = perSlotItems.get(slot);
    if (!items) continue;
    const signal = items.reduce((acc, it) => acc + it.count, 0);
    if (signal > bestSignal) {
      bestSignal = signal;
      bestSlot = slot;
    }
  }
  if (!bestSlot) return null;
  return { slot: bestSlot, seedItems: perSlotItems.get(bestSlot)! };
}
