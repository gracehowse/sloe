/**
 * planDayLabel — shared web/mobile helpers for the Plan tab day header
 * and meal-row icon treatment.
 *
 * Prototype port 2026-04-20 — see
 * `docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 * `PlanScreen` (line 479-505). The prototype shows "Mon" / "Tue" / "Wed"
 * etc. as the day section header (not "Day 1" / "Day 2") and tags the
 * current day with a small uppercase "TODAY" pill. Meal rows get a
 * slot-appropriate 36×36 icon-box on the left.
 *
 * This file is framework-agnostic — it only returns strings (the
 * weekday label) and icon *keys*. Each platform maps the key to its own
 * icon library: web uses `lucide-react`, mobile uses
 * `@expo/vector-icons` (Ionicons). The single-source-of-truth mapping
 * keeps `Sun` ↔ `sunny-outline` / `Utensils` ↔ `restaurant-outline`
 * etc. aligned forever.
 *
 * Pure — no React, no Supabase, safe to import from anywhere.
 */
import { normaliseMealSlot, type MealSlot } from "../nutrition/mealSlots";

/**
 * Canonical slot-icon keys. Each platform has its own adapter for these
 * literals. Non-canonical input (voice parse, legacy data) collapses to
 * the `snacks` icon via `normaliseMealSlot` so the UI never renders a
 * blank square.
 *
 * Mobile (Ionicons) mapping:
 *   breakfast → "sunny-outline"
 *   lunch     → "restaurant-outline"
 *   dinner    → "moon-outline"
 *   snacks    → "ice-cream-outline"
 *
 * Web (lucide-react) mapping:
 *   breakfast → Sun
 *   lunch     → Utensils
 *   dinner    → Moon
 *   snacks    → Cookie
 */
export type PlanSlotIconKey = "breakfast" | "lunch" | "dinner" | "snacks";

/** Map a meal-row `meal.name` (or raw user slot text) to a canonical
 *  icon key. Unknown / empty slots fall through to `"snacks"`. */
export function resolvePlanSlotIconKey(rawSlot: unknown): PlanSlotIconKey {
  const slot: MealSlot | null = normaliseMealSlot(rawSlot);
  switch (slot) {
    case "Breakfast":
      return "breakfast";
    case "Lunch":
      return "lunch";
    case "Dinner":
      return "dinner";
    case "Snacks":
      return "snacks";
    default:
      return "snacks";
  }
}

/**
 * 3-letter English weekday label ("Mon" / "Tue" / …). Always en-US so
 * web + mobile match exactly regardless of device locale — the Plan tab
 * copy is English-only at this prototype stage (there's no i18n yet).
 *
 * Uses `Intl.DateTimeFormat` where available; falls back to a fixed
 * array for environments that lack ICU (older Android + hermes).
 */
const SHORT_WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function shortWeekdayLabel(date: Date): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short" });
    const label = fmt.format(date);
    // Some ICU builds append ".", e.g. "Mon." on older Android. Strip it
    // for consistent typography with the prototype ("Mon").
    return label.replace(/\.$/, "");
  } catch {
    return SHORT_WEEKDAYS_EN[date.getDay()] ?? "";
  }
}

/**
 * Calendar date for a plan row at index `idx`. `startOffset` is the
 * "generate starting from" offset the user picks (0 = today, 1 =
 * tomorrow, 7 = next week). Mirrors
 * `planCalendarDateForIndex` in `apps/mobile/app/(tabs)/planner.tsx`
 * and the inline copy in `src/app/components/MealPlanner.tsx`.
 */
export function planCalendarDateForIndex(idx: number, startOffset: number = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + idx + startOffset);
  return d;
}

/** True when `date` is the same calendar day as `referenceDate` (defaults
 *  to "now" at midnight). Reference is strip-midnight-normalised so
 *  "today" never flips at an odd hour. */
export function isSameCalendarDay(date: Date, referenceDate: Date = new Date()): boolean {
  const a = new Date(date);
  a.setHours(0, 0, 0, 0);
  const b = new Date(referenceDate);
  b.setHours(0, 0, 0, 0);
  return a.getTime() === b.getTime();
}
