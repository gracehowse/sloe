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
