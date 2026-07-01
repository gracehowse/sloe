/**
 * editorialProfileBlock — streak-dot derivation, best-streak, freezes line, and
 * milestones list (ENG-1246, Gap #16). Pins the shared shaping so the web +
 * mobile editorial blocks can't drift from the derived data.
 */

import { describe, expect, it } from "vitest";
import {
  STREAK_DOT_WINDOW,
  buildEditorialProfileBlock,
  buildProfileMilestones,
  buildStreakDots,
  computeBestStreak,
  type StreakDotState,
} from "../../src/lib/profile/editorialProfileBlock";
import type { FreezeLedger, StreakByDay } from "../../src/lib/nutrition/streakFreeze";

/** Build a byDay map from `YYYY-MM-DD` keys, each with one positive-cal meal. */
function loggedDays(...keys: string[]): StreakByDay {
  const byDay: StreakByDay = {};
  for (const k of keys) byDay[k] = [{ calories: 400 }];
  return byDay;
}

const EMPTY_LEDGER: FreezeLedger = { earnedAt: [], usedHistory: [] };

describe("computeBestStreak", () => {
  it("finds the longest consecutive run, not the current one", () => {
    // A 3-day run in the past, then a gap, then a 2-day run to today.
    const byDay = loggedDays(
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-10",
      "2026-06-11",
    );
    expect(computeBestStreak(byDay)).toBe(3);
  });

  it("returns 0 for an empty diary", () => {
    expect(computeBestStreak({})).toBe(0);
  });

  it("ignores days with no positive-calorie meal", () => {
    const byDay: StreakByDay = {
      "2026-06-01": [{ calories: 0 }],
      "2026-06-02": [{ calories: 500 }],
      "2026-06-03": [{ calories: 500 }],
    };
    // 06-01 doesn't count, so the run is 06-02 → 06-03 = 2.
    expect(computeBestStreak(byDay)).toBe(2);
  });
});

describe("buildStreakDots", () => {
  const now = new Date("2026-06-10T12:00:00");

  function states(byDay: StreakByDay, frozen: Set<string> = new Set()): StreakDotState[] {
    return buildStreakDots(byDay, frozen, now).map((d) => d.state);
  }

  it("renders exactly STREAK_DOT_WINDOW dots, oldest first, today last", () => {
    const dots = buildStreakDots(loggedDays("2026-06-10"), new Set(), now);
    expect(dots).toHaveLength(STREAK_DOT_WINDOW);
    expect(dots[STREAK_DOT_WINDOW - 1].isToday).toBe(true);
    expect(dots[STREAK_DOT_WINDOW - 1].dateKey).toBe("2026-06-10");
    expect(dots[0].dateKey).toBe("2026-06-04");
  });

  it("marks logged / missed / frozen states correctly", () => {
    const byDay = loggedDays("2026-06-08", "2026-06-10");
    const frozen = new Set(["2026-06-09"]);
    // Window: 06-04..06-10. 08 + 10 logged, 09 frozen, rest missed.
    expect(states(byDay, frozen)).toEqual([
      "missed", // 04
      "missed", // 05
      "missed", // 06
      "missed", // 07
      "logged", // 08
      "frozen", // 09
      "logged", // 10 (today)
    ]);
  });

  it("prefers logged over frozen when both would apply", () => {
    const byDay = loggedDays("2026-06-10");
    // Even if today were in the frozen set, a real log wins.
    const dots = buildStreakDots(byDay, new Set(["2026-06-10"]), now);
    expect(dots[STREAK_DOT_WINDOW - 1].state).toBe("logged");
  });
});

describe("buildProfileMilestones", () => {
  it("marks milestones achieved once the best streak reaches the threshold", () => {
    // STREAK_MILESTONES = [3, 7, 30, 100]; best of 8 clears 3 + 7.
    const ms = buildProfileMilestones(8);
    expect(ms.map((m) => m.achieved)).toEqual([true, true, false, false]);
  });

  it("flags exactly one next-up milestone (the nearest un-achieved)", () => {
    const ms = buildProfileMilestones(8);
    const next = ms.filter((m) => m.next);
    expect(next).toHaveLength(1);
    expect(next[0].days).toBe(30);
  });

  it("has no next-up once every milestone is achieved", () => {
    const ms = buildProfileMilestones(500);
    expect(ms.every((m) => m.achieved)).toBe(true);
    expect(ms.some((m) => m.next)).toBe(false);
  });

  it("returns milestones sorted ascending", () => {
    const days = buildProfileMilestones(0).map((m) => m.days);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });
});

describe("buildEditorialProfileBlock", () => {
  const now = new Date("2026-06-10T12:00:00");

  it("shapes current streak, best streak, dots, and milestones together", () => {
    const byDay = loggedDays(
      "2026-06-06",
      "2026-06-07",
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
    );
    const model = buildEditorialProfileBlock({
      byDay,
      freezeLedger: EMPTY_LEDGER,
      freezeBudgetMax: 3,
      now,
    });
    expect(model.currentStreak).toBe(5);
    expect(model.bestStreak).toBe(5);
    expect(model.dots).toHaveLength(STREAK_DOT_WINDOW);
    expect(model.freezesAvailable).toBe(0);
    // First-unachieved milestone with a best of 5 is 7.
    expect(model.milestones.find((m) => m.next)?.days).toBe(7);
  });

  it("surfaces freezes in hand from the ledger", () => {
    const ledger: FreezeLedger = {
      earnedAt: [{ earnedAt: "2026-06-01T00:00:00Z" }, { earnedAt: "2026-06-05T00:00:00Z" }],
      usedHistory: [],
    };
    const model = buildEditorialProfileBlock({
      byDay: loggedDays("2026-06-10"),
      freezeLedger: ledger,
      freezeBudgetMax: 3,
      now,
    });
    expect(model.freezesAvailable).toBe(2);
  });

  it("is empty-safe on a brand-new account", () => {
    const model = buildEditorialProfileBlock({
      byDay: {},
      freezeLedger: EMPTY_LEDGER,
      freezeBudgetMax: 3,
      now,
    });
    expect(model.currentStreak).toBe(0);
    expect(model.bestStreak).toBe(0);
    expect(model.freezesAvailable).toBe(0);
    expect(model.dots.every((d) => d.state === "missed")).toBe(true);
    expect(model.milestones.find((m) => m.next)?.days).toBe(3);
  });

  it("floors best at the current streak when a freeze bridges a mid-window gap (M1)", () => {
    // A freeze bridges 06-08 so the CURRENT protected run spans the gap:
    //   06-10 log, 06-09 log, 06-08 FREEZE, 06-07 log, 06-06 log → current = 5.
    // But `computeBestStreak` resets on the zero-food 06-08, so the raw best is
    // only 2 (06-06→07) / 2 (06-09→10). Pre-fix that rendered "5-day streak"
    // over "Best streak 2 days" and flagged the already-crossed 3-day milestone
    // as "next up". The M1 floor = max(computeBestStreak, currentStreak).
    const byDay = loggedDays("2026-06-06", "2026-06-07", "2026-06-09", "2026-06-10");
    const ledger: FreezeLedger = {
      // earnedAt.length (1) > usedHistory.length (0) → one freeze in hand.
      earnedAt: [{ earnedAt: "2026-06-01T00:00:00Z" }],
      usedHistory: [],
    };
    const model = buildEditorialProfileBlock({
      byDay,
      freezeLedger: ledger,
      freezeBudgetMax: 3,
      now,
    });
    // (a) the current streak spans the freeze-bridged gap.
    expect(model.currentStreak).toBe(5);
    // Sanity: the raw (freeze-blind) best is genuinely below the current run.
    expect(computeBestStreak(byDay)).toBe(2);
    // (b) displayed best is never below the live streak.
    expect(model.bestStreak).toBeGreaterThanOrEqual(model.currentStreak);
    expect(model.bestStreak).toBe(5);
    // (c) a milestone at/below the current streak is achieved, not "next up".
    const m3 = model.milestones.find((m) => m.days === 3);
    expect(m3?.achieved).toBe(true);
    expect(m3?.next).toBe(false);
    // The nearest un-achieved landmark is the next one up (7), not 3.
    expect(model.milestones.find((m) => m.next)?.days).toBe(7);
  });
});
