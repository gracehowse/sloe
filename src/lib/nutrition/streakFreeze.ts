/**
 * Streak freeze (Batch 4.11) — retention-friendly streak protection.
 *
 * A hard "log every day or lose it" streak is the classic Duolingo trap:
 * one sick day, one travel day, and the user feels punished. This helper
 * lets the user hold a small budget of *freezes* that absorb a zero-meal
 * day so the streak keeps counting.
 *
 * Non-negotiables:
 *   - The raw streak (see `computeLoggingStreak` in `trackerStats.ts`) is
 *     never mutated. `computeProtectedStreak` returns a *derived* number
 *     plus the date keys that were saved by freezes, so the UI can show
 *     both values side-by-side without lying ("5-day streak" + "Freeze
 *     used Tue").
 *   - Zero freeze budget (`budgetMax === 0`) disables the feature cleanly
 *     — `availableFreezes` returns 0 and `computeProtectedStreak`
 *     degrades to the same behaviour as the raw streak walk.
 *   - All inputs are plain JSON so the ledger can ride on the existing
 *     `profiles` JSONB columns introduced by
 *     `20260421170000_streak_freeze_weekly_recap.sql`.
 *
 * Pure module — no React, no Supabase, no Date.now() side-effects beyond
 * the optional `now` parameter.
 */

import type { LoggedMeal } from "../../types/recipe";
import { dateKeyFromDate } from "./trackerStats";

/** Entry in the earned-freezes ledger. */
export type FreezeEarnedEntry = { earnedAt: string };

/** Entry in the consumed-freezes ledger (dateKey = the saved zero-day). */
export type FreezeUsedEntry = { dateKey: string; earnedAt: string };

/** Full ledger shape persisted on `profiles`. */
export type FreezeLedger = {
  earnedAt: FreezeEarnedEntry[];
  usedHistory: FreezeUsedEntry[];
};

/**
 * Minimal meal shape for streak-walking. Mirrors `MealMacros` in
 * `progressWeekReport.ts` so either platform's meal type satisfies it
 * without a cast — `computeProtectedStreak` only needs `.length` checks.
 */
export type StreakMeal = { calories: number } | LoggedMeal;

/** Days-of-meals map (date key `YYYY-MM-DD` → meal list). */
export type StreakByDay = Record<string, StreakMeal[]>;

/** Milliseconds per day — constant, avoids DST drift on the `<` comparison. */
const MS_PER_DAY = 86_400_000;

/**
 * Freezes the user currently holds. `earnedAt.length - usedHistory.length`,
 * clamped to `[0, budgetMax]`. Negative or missing arrays are treated as
 * empty — callers should still call `.readFreezeLedger` to parse DB rows.
 */
export function availableFreezes(
  ledger: FreezeLedger,
  budgetMax: number,
): number {
  if (!Number.isFinite(budgetMax) || budgetMax <= 0) return 0;
  const earned = Array.isArray(ledger.earnedAt) ? ledger.earnedAt.length : 0;
  const used = Array.isArray(ledger.usedHistory) ? ledger.usedHistory.length : 0;
  const net = earned - used;
  if (net <= 0) return 0;
  return Math.min(net, Math.floor(budgetMax));
}

/**
 * Protected streak — walks backward from today/yesterday and, on a
 * zero-meal day, consumes a freeze (if available) instead of breaking.
 *
 * The return value always includes `freezesConsumed` (0 if the user had
 * a clean streak) and `protectedDateKeys` — the keys that were saved so
 * the UI can render a factual badge.
 *
 * Starts at today if today has meals; otherwise starts at yesterday
 * (same "grace window" as `computeLoggingStreak` so a user who hasn't
 * logged yet today still sees their streak until end-of-day).
 */
export function computeProtectedStreak(
  byDay: StreakByDay,
  ledger: FreezeLedger,
  budgetMax: number,
  now: Date = new Date(),
): { streakLength: number; freezesConsumed: number; protectedDateKeys: string[] } {
  const startFreezes = availableFreezes(ledger, budgetMax);
  let freezesLeft = startFreezes;
  let streak = 0;
  const protectedDateKeys: string[] = [];

  const cursor = new Date(now);
  const todayKey = dateKeyFromDate(cursor);
  const todayMeals = byDay[todayKey] ?? [];
  // Grace window: if today is empty, start walking from yesterday. This
  // matches `computeLoggingStreak` exactly so the "raw" and "protected"
  // streaks agree when no freezes are needed.
  if (todayMeals.length === 0) {
    cursor.setTime(cursor.getTime() - MS_PER_DAY);
  }

  // Safety cap — real user histories don't exceed a few years of days,
  // but prevent an infinite walk if someone pollutes the ledger.
  const MAX_WALK = 2000;
  for (let i = 0; i < MAX_WALK; i++) {
    const key = dateKeyFromDate(cursor);
    const meals = byDay[key] ?? [];
    if (meals.length > 0) {
      streak++;
    } else if (freezesLeft > 0) {
      freezesLeft--;
      streak++;
      protectedDateKeys.push(key);
    } else {
      break;
    }
    cursor.setTime(cursor.getTime() - MS_PER_DAY);
  }

  return {
    streakLength: streak,
    freezesConsumed: startFreezes - freezesLeft,
    protectedDateKeys,
  };
}

/**
 * Freeze-earning milestone — each time the streak crosses a multiple of
 * 7 days (7, 14, 21, 28 …), the user earns one freeze. `7 → 8` does not
 * earn a freeze; `6 → 7` does. `0 → 7` earns exactly one (not seven).
 *
 * Returning `{ earned: false }` keeps callers branch-free; when
 * `earned: true` the `at` ISO string is ready to push onto
 * `ledger.earnedAt`.
 */
export function earnFreezeIfMilestone(
  priorStreak: number,
  newStreak: number,
  now: Date = new Date(),
): { earned: boolean; at?: string } {
  if (!Number.isFinite(priorStreak) || !Number.isFinite(newStreak)) {
    return { earned: false };
  }
  if (newStreak <= priorStreak) return { earned: false };
  const priorMilestones = Math.floor(Math.max(0, priorStreak) / 7);
  const newMilestones = Math.floor(Math.max(0, newStreak) / 7);
  if (newMilestones > priorMilestones) {
    return { earned: true, at: now.toISOString() };
  }
  return { earned: false };
}

/**
 * Trim ledger entries older than 90 days to keep the JSONB columns
 * bounded. We never drop `usedHistory` entries (they power the "Freeze
 * used (Tue)" UI) — only `earnedAt` rows that have no matching use.
 * This is a best-effort compaction; callers should persist the result.
 */
export function dropOldFreezesForMonth(
  ledger: FreezeLedger,
  now: Date = new Date(),
): FreezeLedger {
  const cutoffMs = now.getTime() - 90 * MS_PER_DAY;
  const earnedAt = (Array.isArray(ledger.earnedAt) ? ledger.earnedAt : []).filter(
    (entry) => {
      const t = Date.parse(entry.earnedAt);
      return Number.isFinite(t) && t >= cutoffMs;
    },
  );
  const usedHistory = Array.isArray(ledger.usedHistory) ? ledger.usedHistory : [];
  return { earnedAt, usedHistory };
}

/**
 * Best-effort JSON parser for the ledger columns — DB rows can come back
 * as `unknown` (Supabase returns `Json | null`) so callers should route
 * through this to guarantee the pure helpers above get a well-formed
 * shape.
 */
export function readFreezeLedger(raw: {
  earnedAt?: unknown;
  usedHistory?: unknown;
}): FreezeLedger {
  const earnedAt: FreezeEarnedEntry[] = [];
  const usedHistory: FreezeUsedEntry[] = [];
  if (Array.isArray(raw.earnedAt)) {
    for (const entry of raw.earnedAt) {
      if (entry && typeof entry === "object") {
        const at = (entry as { earnedAt?: unknown }).earnedAt;
        if (typeof at === "string" && at.length > 0) earnedAt.push({ earnedAt: at });
      }
    }
  }
  if (Array.isArray(raw.usedHistory)) {
    for (const entry of raw.usedHistory) {
      if (entry && typeof entry === "object") {
        const dk = (entry as { dateKey?: unknown }).dateKey;
        const at = (entry as { earnedAt?: unknown }).earnedAt;
        if (typeof dk === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dk)) {
          usedHistory.push({
            dateKey: dk,
            earnedAt: typeof at === "string" ? at : "",
          });
        }
      }
    }
  }
  return { earnedAt, usedHistory };
}
