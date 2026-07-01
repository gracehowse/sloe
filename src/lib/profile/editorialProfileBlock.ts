/**
 * editorialProfileBlock — shared props-shaping + streak/dot math for the
 * editorial Profile block (Gap #16, ENG-1246).
 *
 * Gap #16 was PARTIAL on both platforms: identity card + a bare streak
 * *number* + a recipe *count* tile, rendered as two divergent inline strips.
 * This module is the single, framework-free source of truth for the derived
 * shapes the block renders, so web and mobile can't drift:
 *
 *   1. Streak DOTS — a fixed trailing window (last N days) where each day is
 *      `logged` / `frozen` / `missed`, derived from the same `byDay` map + the
 *      freeze `protectedDateKeys` the Today/Progress streak already computes.
 *   2. Best-streak / freezes LINE — the all-time best run + freezes still in
 *      hand, reusing `computeProtectedStreak` + `availableFreezes` (no new
 *      streak logic invented here).
 *   3. MILESTONES list — reuses the existing `STREAK_MILESTONES` thresholds
 *      (3 / 7 / 30 / 100) from `winMomentLandmark.ts`. No new milestone logic:
 *      a milestone is `achieved` once the best streak reaches its threshold,
 *      and exactly one un-achieved milestone is flagged `next` so the surface
 *      can render a forward target.
 *
 * Pure module — no React, no Supabase, no side-effects beyond the optional
 * `now` parameter. Mobile imports it via `@suppr/shared/profile/editorialProfileBlock`.
 */

import {
  availableFreezes,
  computeProtectedStreak,
  type FreezeLedger,
  type StreakByDay,
} from "../nutrition/streakFreeze";
import { dateKeyFromDate } from "../datetime/dateKey";
import { STREAK_MILESTONES } from "../nutrition/winMomentLandmark";

/** Number of trailing days the dot row renders. One week reads at a glance
 *  and matches the Today streak-pip's mental model without crowding the card. */
export const STREAK_DOT_WINDOW = 7;

/** Milliseconds per day — constant, avoids DST drift on the day walk. */
const MS_PER_DAY = 86_400_000;

/** A single day in the trailing streak-dot row. */
export type StreakDotState = "logged" | "frozen" | "missed";

export interface StreakDot {
  /** `YYYY-MM-DD` this dot represents. */
  dateKey: string;
  /** Whether the day had ≥1 logged meal, was covered by a freeze, or missed. */
  state: StreakDotState;
  /** True for the last dot in the row (today) — lets the UI ring the current day. */
  isToday: boolean;
}

/** One row in the milestones list. */
export interface ProfileMilestone {
  /** Streak length in days that unlocks this milestone (from STREAK_MILESTONES). */
  days: number;
  /** Reached once the best streak ≥ `days`. */
  achieved: boolean;
  /** The single next un-achieved milestone (nearest target). At most one row true. */
  next: boolean;
}

export interface EditorialProfileBlockInput {
  /** Day → meal list map (only `.length`/positive-calorie checks are used). */
  byDay: StreakByDay;
  /** Parsed freeze ledger (same shape Today/Progress read). */
  freezeLedger: FreezeLedger;
  /** Max freeze budget (profiles.streak_freeze_budget_max; defaults handled upstream). */
  freezeBudgetMax: number;
  /** Injectable clock for deterministic tests. */
  now?: Date;
}

export interface EditorialProfileBlockModel {
  /** Current protected streak length (matches Today/Progress exactly). */
  currentStreak: number;
  /** Best (longest ever) consecutive-logging run in the byDay window. */
  bestStreak: number;
  /** Freezes still available to absorb a missed day. */
  freezesAvailable: number;
  /** Trailing `STREAK_DOT_WINDOW` days, oldest-first, for the dot row. */
  dots: StreakDot[];
  /** Milestones list — every STREAK_MILESTONES threshold with achieved/next state. */
  milestones: ProfileMilestone[];
}

/** True when a day has ≥1 meal with positive calories (mirrors milestone30Day). */
function dayHasFood(meals: StreakByDay[string] | undefined): boolean {
  if (!Array.isArray(meals) || meals.length === 0) return false;
  return meals.some((m) => Math.max(0, (m as { calories?: number }).calories ?? 0) > 0);
}

/**
 * Longest consecutive run of logged days anywhere in `byDay`. Distinct from
 * the *current* streak — this is the all-time high, computed by the same walk
 * `milestone30Day` uses (kept local so this module has no cross-import cycle).
 */
export function computeBestStreak(byDay: StreakByDay): number {
  const sortedKeys = Object.keys(byDay).sort();
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const key of sortedKeys) {
    if (!dayHasFood(byDay[key])) {
      run = 0;
      prev = null;
      continue;
    }
    const [y, m, d] = key.split("-").map((n) => parseInt(n, 10));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) continue;
    const cur = Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
    if (prev != null && Math.round((cur - prev) / MS_PER_DAY) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = cur;
  }
  return longest;
}

/**
 * Build the trailing dot row: `STREAK_DOT_WINDOW` days ending today, oldest
 * first. A day is `logged` if it had food, `frozen` if a freeze covered it
 * (present in `protectedDateKeys`), else `missed`.
 */
export function buildStreakDots(
  byDay: StreakByDay,
  protectedDateKeys: Set<string>,
  now: Date,
): StreakDot[] {
  const dots: StreakDot[] = [];
  const todayKey = dateKeyFromDate(now);
  // Walk oldest → newest so the row reads left-to-right like a calendar week.
  for (let offset = STREAK_DOT_WINDOW - 1; offset >= 0; offset--) {
    const cursor = new Date(now.getTime() - offset * MS_PER_DAY);
    const key = dateKeyFromDate(cursor);
    const state: StreakDotState = dayHasFood(byDay[key])
      ? "logged"
      : protectedDateKeys.has(key)
        ? "frozen"
        : "missed";
    dots.push({ dateKey: key, state, isToday: key === todayKey });
  }
  return dots;
}

/**
 * Build the milestones list from the existing STREAK_MILESTONES thresholds.
 * `achieved` when the best streak reached the threshold; the nearest
 * un-achieved milestone (if any) is flagged `next`.
 */
export function buildProfileMilestones(bestStreak: number): ProfileMilestone[] {
  const sorted = [...STREAK_MILESTONES].sort((a, b) => a - b);
  const firstUnachieved = sorted.find((days) => bestStreak < days);
  return sorted.map((days) => ({
    days,
    achieved: bestStreak >= days,
    next: days === firstUnachieved,
  }));
}

/**
 * Shape the full editorial-profile model from already-loaded data. Callers
 * pass the SAME `byDay` map + freeze ledger the Today/Progress streak reads —
 * this module never fetches.
 */
export function buildEditorialProfileBlock(
  input: EditorialProfileBlockInput,
): EditorialProfileBlockModel {
  const now = input.now ?? new Date();
  const protectedResult = computeProtectedStreak(
    input.byDay,
    input.freezeLedger,
    input.freezeBudgetMax,
    now,
  );
  const bestStreak = computeBestStreak(input.byDay);
  return {
    currentStreak: protectedResult.streakLength,
    bestStreak,
    freezesAvailable: availableFreezes(input.freezeLedger, input.freezeBudgetMax),
    dots: buildStreakDots(input.byDay, new Set(protectedResult.protectedDateKeys), now),
    milestones: buildProfileMilestones(bestStreak),
  };
}
