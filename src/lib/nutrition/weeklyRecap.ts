/**
 * Weekly recap (Batch 4.11) — pure builder + gating for the Sunday-evening
 * recap card on the Progress dashboard.
 *
 * What this module owns:
 *   - `buildWeeklyRecap` — collapses a week of meals + weights into a
 *     display-ready summary (avg kcal, protein adherence %, streak, best
 *     day, weight delta).
 *   - `weekKeyFor` — stable ISO-week-ish key (`YYYY-Www`) that respects
 *     the user's `week_start_day` so Sunday-first users don't
 *     accidentally see Monday-first weeks.
 *   - `shouldShowRecap` — gate that decides whether the card renders
 *     this visit (week has ended + user hasn't dismissed it yet).
 *
 * Parity: consumed by both the web `WeeklyRecapCard` and the mobile
 * `WeeklyRecapCard`. All labels are factual and supportive — "3 days
 * logged this week" not "You missed 4 days".
 *
 * Pure module — no React, no network.
 */

import type { ByDayOf, MealMacros } from "./progressWeekReport";
import { buildWeekStats } from "./progressWeekReport";
import { dateKeyFromDate } from "./trackerStats";
import {
  availableFreezes,
  computeProtectedStreak,
  type FreezeLedger,
  type StreakByDay,
} from "./streakFreeze";

export type WeeklyRecap = {
  /** `YYYY-Www` key for the completed week this recap covers. */
  weekKey: string;
  /** "Apr 6 – Apr 12" human label, locale-free so tests are stable. */
  weekLabel: string;
  /** Number of days with ≥1 meal logged in this 7-day window. */
  daysLogged: number;
  /** Average daily calories over days-with-food (not over all 7). */
  avgCalories: number;
  /** Average daily protein (g) over days-with-food. */
  avgProtein: number;
  /** `avgProtein / targets.protein * 100`, rounded. `0` if no target. */
  proteinAdherencePct: number;
  /** Protected streak length at the moment of recap generation. */
  streakLength: number;
  /** Freezes the user currently holds (after any streak protection). */
  freezesAvailable: number;
  /** The single highest-logged-protein day; `null` if no food logged. */
  bestDay: { key: string; label: string; calories: number; protein: number } | null;
  /**
   * Weight change across the week in kg, rounded to 0.1. `null` if we
   * don't have ≥2 weigh-ins inside the window — we never show
   * "+0.0 kg" as a faux result.
   */
  weightDeltaKg: number | null;
};

/**
 * Build the recap for the *previous completed week* — i.e. the week
 * that ended just before `now`. Uses the user's `weekStartDay` so a
 * Sunday-start user sees Sun-to-Sat, and a Monday-start user sees
 * Mon-to-Sun.
 */
export function buildWeeklyRecap<M extends MealMacros>(params: {
  byDay: ByDayOf<M>;
  weightKgByDay: Record<string, number>;
  targets: { calories: number; protein: number; carbs: number; fat: number };
  weekStartDay: "monday" | "sunday";
  ledger: FreezeLedger;
  budgetMax: number;
  now?: Date;
}): WeeklyRecap {
  const now = params.now ?? new Date();

  // Anchor on the *previous* week. We subtract 7 days from "now" and
  // then let buildWeekStats snap to the week containing that anchor.
  const previousWeekAnchor = new Date(now);
  previousWeekAnchor.setDate(previousWeekAnchor.getDate() - 7);

  const bundle = buildWeekStats(
    params.byDay,
    params.targets,
    params.weekStartDay,
    previousWeekAnchor,
  );

  const daysLogged = bundle.days.filter((d) => d.calories > 0).length;
  // `buildWeekStats` returns 0 averages when no days were logged; keep
  // that behaviour so the UI can detect "nothing to recap" cleanly.
  const avgCalories = daysLogged > 0 ? bundle.avgCalories : 0;
  const avgProtein = daysLogged > 0 ? bundle.avgProtein : 0;
  const proteinAdherencePct =
    params.targets.protein > 0
      ? Math.round((avgProtein / params.targets.protein) * 100)
      : 0;

  // Best day = highest protein among days with food. Ties → first.
  let bestDay: WeeklyRecap["bestDay"] = null;
  for (const d of bundle.days) {
    if (d.calories <= 0) continue;
    if (!bestDay || d.protein > bestDay.protein) {
      bestDay = { key: d.key, label: d.label, calories: d.calories, protein: d.protein };
    }
  }

  // Weight delta across the same 7-day window. Need ≥2 entries; we
  // refuse to guess otherwise.
  const weightKeys = bundle.days.map((d) => d.key);
  const firstKey = weightKeys[0]!;
  const lastKey = weightKeys[weightKeys.length - 1]!;
  const withinWeek = Object.entries(params.weightKgByDay)
    .filter(([k]) => k >= firstKey && k <= lastKey)
    .sort(([a], [b]) => a.localeCompare(b));
  let weightDeltaKg: number | null = null;
  if (withinWeek.length >= 2) {
    const first = withinWeek[0][1];
    const last = withinWeek[withinWeek.length - 1][1];
    if (Number.isFinite(first) && Number.isFinite(last)) {
      weightDeltaKg = Math.round((last - first) * 10) / 10;
    }
  }

  const streak = computeProtectedStreak(
    params.byDay as unknown as StreakByDay,
    params.ledger,
    params.budgetMax,
    now,
  );
  const freezesAvailable = availableFreezes(params.ledger, params.budgetMax);

  return {
    weekKey: weekKeyFor(previousWeekAnchor, params.weekStartDay),
    weekLabel: formatWeekLabel(firstKey, lastKey),
    daysLogged,
    avgCalories,
    avgProtein,
    proteinAdherencePct,
    streakLength: streak.streakLength,
    freezesAvailable,
    bestDay,
    weightDeltaKg,
  };
}

/**
 * Human-readable "Apr 6 – Apr 12" range. Locale-free (uses hard-coded
 * English month abbreviations) so component snapshot tests and
 * screenshot QA match across CI machines.
 */
export function formatWeekLabel(firstKey: string, lastKey: string): string {
  const fmt = (key: string): string => {
    const [y, m, d] = key.split("-").map((n) => Number.parseInt(n, 10));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return key;
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${months[m - 1]} ${d}`;
  };
  return `${fmt(firstKey)} – ${fmt(lastKey)}`;
}

/**
 * Week key `YYYY-Www` — "ISO-week-ish" because we honour the user's
 * `week_start_day` preference instead of the strict Mon-start ISO-8601
 * definition. For Monday-start users the result equals true ISO week
 * (modulo year-boundary rules in a handful of edge cases); for
 * Sunday-start the week can land one unit earlier at the boundary.
 *
 * The week number is 1-based on `(dayOfYearOfWeekStart / 7) + 1`, which
 * is stable enough for "have we shown this week's recap yet" gating.
 */
export function weekKeyFor(
  now: Date,
  weekStartDay: "monday" | "sunday",
): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const offset = weekStartDay === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() + offset);
  // Week number is derived from the *week-start* date so year rollover
  // is consistent: if the week starts Dec 30 2024 (Mon), weekKey is
  // `2024-W53`, not `2025-W01`.
  const year = weekStart.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const dayOfYear = Math.floor(
    (weekStart.getTime() - jan1.getTime()) / 86_400_000,
  );
  const weekNum = Math.floor(dayOfYear / 7) + 1;
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * Decide whether to surface the recap card this visit.
 *
 *   - Returns `false` until the *previous* week has ended — the card is
 *     a Sunday-evening (or Saturday-evening for Monday-start) moment,
 *     so showing it mid-week is premature.
 *   - Returns `false` when the user has already seen/dismissed this
 *     week's recap (matching `weekKeyFor(now)`).
 *
 * We compare the week-key of "now" against `lastSeenWeekKey`. When a
 * user dismisses, the caller writes `weekKeyFor(now)` into
 * `weekly_recap_last_seen_week_key`, which suppresses the card until
 * the next week-key flip.
 */
export function shouldShowRecap(
  lastSeenWeekKey: string | null | undefined,
  currentWeekKey: string,
  now: Date = new Date(),
  weekStartDay: "monday" | "sunday" = "monday",
): boolean {
  // Gate 1: already dismissed this week → don't re-show.
  if (lastSeenWeekKey && lastSeenWeekKey === currentWeekKey) return false;

  // Gate 2: end-of-week heuristic. The recap card describes the week
  // that just ended. For Sunday-start users, the week ends Saturday —
  // we show from Saturday 18:00 local. For Monday-start users, the
  // week ends Sunday — we show from Sunday 18:00 local. Before that
  // window in the first few days of the week, the previous week's
  // recap is still fresh to show; we only suppress the "mid-week
  // premature" case.
  const dow = now.getDay(); // 0=Sun..6=Sat
  const hour = now.getHours();
  if (weekStartDay === "sunday") {
    // Week runs Sun..Sat; recap window = Sat ≥18:00 OR Sun/Mon/Tue.
    const isWeekendEnd = dow === 6 && hour >= 18;
    const isEarlyNextWeek = dow === 0 || dow === 1 || dow === 2;
    if (!isWeekendEnd && !isEarlyNextWeek) return false;
  } else {
    // Week runs Mon..Sun; recap window = Sun ≥18:00 OR Mon/Tue/Wed.
    const isWeekendEnd = dow === 0 && hour >= 18;
    const isEarlyNextWeek = dow === 1 || dow === 2 || dow === 3;
    if (!isWeekendEnd && !isEarlyNextWeek) return false;
  }

  return true;
}

/**
 * Shareable plain-text summary — used by both platforms' "Share week"
 * button. Kept in the shared helper so the copy can't drift between
 * web (Clipboard) and mobile (Share API).
 */
export function formatRecapForShare(recap: WeeklyRecap): string {
  const lines: string[] = [
    `My week on Suppr (${recap.weekLabel})`,
    `• ${recap.daysLogged}/7 days logged`,
    `• Avg ${recap.avgCalories} kcal / day`,
    `• Avg ${recap.avgProtein}g protein (${recap.proteinAdherencePct}% of target)`,
    `• ${recap.streakLength}-day streak`,
  ];
  if (recap.bestDay) {
    lines.push(
      `• Best day: ${recap.bestDay.label} — ${recap.bestDay.protein}g protein`,
    );
  }
  if (recap.weightDeltaKg != null) {
    const sign = recap.weightDeltaKg > 0 ? "+" : "";
    lines.push(`• Weight: ${sign}${recap.weightDeltaKg} kg`);
  }
  return lines.join("\n");
}

/** Cheap helper to derive the current week's dateKeyFromDate-style labels. */
export function currentWeekKey(
  weekStartDay: "monday" | "sunday",
  now: Date = new Date(),
): string {
  return weekKeyFor(now, weekStartDay);
}

/**
 * Compute the next Sunday-18:00 (Monday-start users) or Saturday-18:00
 * (Sunday-start users) date in the caller's local timezone. Used by
 * the mobile push scheduler; kept here in the shared helper so it has
 * platform-free unit coverage.
 */
export function nextRecapFireDate(
  weekStartDay: "monday" | "sunday",
  now: Date = new Date(),
): Date {
  // Monday-start → recap lands Sunday (dow=0); Sunday-start → Saturday (dow=6).
  const targetDow = weekStartDay === "monday" ? 0 : 6;
  const next = new Date(now);
  next.setHours(18, 0, 0, 0);
  const dow = next.getDay();
  let daysAhead = (targetDow - dow + 7) % 7;
  if (daysAhead === 0 && now.getTime() >= next.getTime()) {
    daysAhead = 7;
  }
  next.setDate(next.getDate() + daysAhead);
  return next;
}

/** Back-compat re-export so callers can import all recap helpers from one place. */
export { dateKeyFromDate };

/**
 * Ship M1 (2026-04-18) — weekly recap "usual meals" growth-loop line.
 *
 * Keeps the core `WeeklyRecap` type unchanged (tests + share-string
 * callers shouldn't have to move) and adds a second pure builder that
 * decides which of three states the recap card should surface:
 *
 *   - `celebration` — user has ≥1 saved meal AND at least one was logged
 *     in the last 7 days. Format: "You logged {name} {n} times this week."
 *     Picks the most-logged saved meal in the window; ties break by most
 *     recently logged.
 *   - `prompt` — user has no saved meals AND has logged ≥5 distinct days.
 *     Format: "Got a usual breakfast? Save it once, log it in one tap."
 *     The prompt CTA seeds `SaveMealDialog` with the slot that has the
 *     largest item-count across the week (usually Breakfast).
 *   - `null` — neither gate passes. The recap card renders without the
 *     usual-meals line at all.
 *
 * Pure — no React, no storage. Both platforms call this and render the
 * three states in their own `WeeklyRecapCard`.
 */

export type UsualMealRecapInsight =
  | {
      kind: "celebration";
      /** Saved meal name, verbatim (may be user-entered mixed case). */
      name: string;
      /** Number of times this saved meal was logged in the 7-day window. */
      count: number;
    }
  | {
      kind: "prompt";
      /** Slot with the largest item-count across the week — the "pre-seed"
       * target when the user taps the prompt CTA. */
      suggestedSlot: "Breakfast" | "Lunch" | "Dinner" | "Snacks";
    }
  | null;

export type UsualMealRecapInsightInput<M extends MealMacros> = {
  byDay: ByDayOf<M>;
  /** `YYYY-MM-DD` keys for the 7 days the recap covers. */
  weekKeys: readonly string[];
  /** User's saved meals. Empty array when the user has none. */
  savedMeals: ReadonlyArray<{
    id: string;
    name: string;
    defaultMealSlot?: string;
    lastLoggedAt?: string;
  }>;
  /**
   * Per-saved-meal log count over the 7-day window. Normally derived
   * from journal rows whose `source === "Saved meal"` or whose (title,
   * kcal) matches an item in a saved meal — the caller owns matching
   * because journal rows don't carry a `savedMealId` today. If the
   * caller has no signal, passing `{}` lands on `prompt` when the
   * distinct-days gate is met.
   */
  logCountBySavedMealId: Readonly<Record<string, number>>;
};

/**
 * Pure helper — see `UsualMealRecapInsight` for the three states.
 */
export function buildUsualMealRecapInsight<M extends MealMacros>(
  input: UsualMealRecapInsightInput<M>,
): UsualMealRecapInsight {
  const { byDay, weekKeys, savedMeals, logCountBySavedMealId } = input;

  // Celebration path — pick the most-logged saved meal in the window.
  if (savedMeals.length > 0) {
    let topId: string | null = null;
    let topCount = 0;
    for (const m of savedMeals) {
      const c = logCountBySavedMealId[m.id] ?? 0;
      if (c > topCount) {
        topId = m.id;
        topCount = c;
      } else if (c > 0 && c === topCount && topId && m.lastLoggedAt) {
        // Tie-break on most recently logged.
        const existing = savedMeals.find((x) => x.id === topId);
        const tExisting = existing?.lastLoggedAt
          ? Date.parse(existing.lastLoggedAt)
          : 0;
        const tCandidate = Date.parse(m.lastLoggedAt);
        if (tCandidate > tExisting) {
          topId = m.id;
        }
      }
    }
    if (topId && topCount > 0) {
      const name = savedMeals.find((m) => m.id === topId)?.name;
      if (name) {
        return { kind: "celebration", name, count: topCount };
      }
    }
    // User owns a saved meal but it wasn't logged this week — suppress
    // both the celebration line (there's nothing concrete to celebrate)
    // and the prompt (they already know the feature exists).
    return null;
  }

  // Prompt path — no saved meals yet. Gate on ≥5 distinct logged days.
  const daysLogged = weekKeys.filter((k) => {
    const meals = byDay[k];
    return Array.isArray(meals) && meals.length > 0;
  }).length;
  if (daysLogged < 5) return null;

  // Suggest the slot with the highest item-count across the week.
  const slotCounts: Record<"Breakfast" | "Lunch" | "Dinner" | "Snacks", number> = {
    Breakfast: 0,
    Lunch: 0,
    Dinner: 0,
    Snacks: 0,
  };
  for (const k of weekKeys) {
    const meals = byDay[k] ?? [];
    for (const m of meals) {
      const slotName = ((m as unknown as { name?: string }).name ?? "").trim();
      if (slotName === "Breakfast" || slotName === "Lunch" || slotName === "Dinner" || slotName === "Snacks") {
        slotCounts[slotName] += 1;
      } else if (slotName === "Snack") {
        slotCounts.Snacks += 1;
      }
    }
  }
  const suggested = (Object.entries(slotCounts) as Array<
    [keyof typeof slotCounts, number]
  >).reduce<[keyof typeof slotCounts, number]>(
    (top, next) => (next[1] > top[1] ? next : top),
    ["Breakfast", 0],
  );
  return { kind: "prompt", suggestedSlot: suggested[0] };
}
