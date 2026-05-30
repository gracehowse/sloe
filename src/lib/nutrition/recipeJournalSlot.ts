/**
 * Recipe-to-journal meal-slot resolution.
 *
 * Build 41 (TestFlight `AB1PYpfPjbd9li7jtnlAsIE`, 2026-05-01) — extracted
 * from `apps/mobile/app/recipe/[id].tsx` so the resolution can be unit-
 * tested + shared with web's CookMode log path.
 *
 * Priority ladder (highest first):
 *   1. `recipe.meal_type` set explicitly at import time (or by the
 *      auto-classifier in `classifyMealType`). User reported a
 *      "breakfast recipe she'd marked as such on import" was logged
 *      to Lunch, so the Build 40 hard-fallback to "Lunch" was wrong;
 *      the meal_type, when present, must be honoured first.
 *   2. Time-of-day fallback — when meal_type is null/empty, pick the
 *      slot that matches when the user tapped Log (matches CookMode
 *      web parity). Better than always-Lunch when the user logs at
 *      8am or 7pm.
 *   3. `normaliseMealSlot` last-chance — hand the raw first
 *      meal_type string to the shared helper for any
 *      "Brunch"-style aliases the includes() chain didn't catch.
 *      Falls back to time-of-day on failure rather than "Lunch".
 *
 * Returns one of: "Breakfast" | "Lunch" | "Snacks" | "Dinner" — the
 * canonical journal slot strings used by `nutrition_entries.name`.
 */
import { normaliseMealSlot } from "./mealSlots";

/**
 * Time-of-day → meal-slot ladder. Hour boundaries match the web
 * `CookMode.tsx:415` fallback so platforms agree on what "Lunch" means
 * on a 4pm log. Local device time on purpose: a US user logging at
 * 8am EST should see Breakfast, regardless of UTC.
 */
export function slotForHour(
  hour: number,
): "Breakfast" | "Lunch" | "Snacks" | "Dinner" {
  if (hour < 11) return "Breakfast";
  if (hour < 15) return "Lunch";
  if (hour < 17) return "Snacks";
  return "Dinner";
}

export function fallbackSlotFromTimeOfDay(now: Date = new Date()): string {
  // ENG-773 (2026-05-30): single source of truth for the time-of-day
  // → slot ladder. The mobile Today quick-log path previously carried
  // its own `slotForHour` (cutoffs 10/14/17) that disagreed with this
  // (11/15/17), so the same clock time bucketed a 10–11am / 2–3pm log
  // into different meals depending on entry path. Both now call
  // `slotForHour` here.
  return slotForHour(now.getHours());
}

/**
 * Resolve the journal meal-slot for a recipe Log action.
 *
 * Notes for callers:
 *   - `mealType` is the recipe's `meal_type` array (string[] | null).
 *     The caller does not need to coerce — null / undefined / empty
 *     all flow to the time-of-day fallback.
 *   - `now` is exposed for tests; production callers should let it
 *     default to `new Date()`.
 */
export function journalSlotFromMealTypes(
  mealType: string[] | null | undefined,
  now: Date = new Date(),
): string {
  if (!mealType?.length) return fallbackSlotFromTimeOfDay(now);
  const joined = mealType.map((t) => t.toLowerCase()).join(" ");
  if (joined.includes("breakfast")) return "Breakfast";
  if (joined.includes("lunch")) return "Lunch";
  if (joined.includes("dinner") || joined.includes("supper")) return "Dinner";
  if (joined.includes("snack")) return "Snacks";
  // Audit L5 (2026-04-18): shared canonical slot helper.
  // Build 41 fix: when the helper can't normalise either, fall back
  // to time-of-day rather than always-Lunch.
  return normaliseMealSlot(mealType[0]) ?? fallbackSlotFromTimeOfDay(now);
}
