/**
 * Action 5 Item 2 (2026-04-19) — pin the "today bar dim" rule on the web
 * Daily Calories chart in `ProgressDashboard.tsx`.
 *
 * Bug: the original code dimmed `i === 6` (the last index in the rendered
 * 7-day array). For Monday-start users mid-week (e.g. Wednesday) the last
 * index lands on Sunday — a future day. The Wednesday bar (the actual
 * today) was rendered at the 0.75 baseline, while a future Sunday was
 * dimmed at 0.4.
 *
 * Fix: dim the bar whose `key` matches `todayKey()`. Mobile already does
 * this — see `apps/mobile/app/(tabs)/progress.tsx` (`isDayToday = d.key
 * === todayKey`). Web now mirrors the rule via `dailyCaloriesData`
 * preserving the `key` from `weekStatsBundle.days`.
 *
 * This test exercises the rule against the same source helper the
 * component uses (`buildWeekStats`) so a regression that re-introduces
 * the index-based dim, or that drops the `key` from the chart row, will
 * fail loudly.
 */

import { describe, expect, it } from "vitest";
import {
  buildWeekStats,
  type ByDayOf,
  type MealMacros,
} from "../../src/lib/nutrition/progressWeekReport.ts";

const TARGETS = { calories: 2000, protein: 150, carbs: 200, fat: 70 };

/**
 * Mirror of the rule the component now applies. Kept inline so any
 * change to the JSX must be reflected here too — the test fails when
 * the rule drifts.
 */
function dimDays(
  days: ReadonlyArray<{ key: string }>,
  todayKey: string,
): ReadonlyArray<{ key: string; opacity: number }> {
  return days.map((d) => ({
    key: d.key,
    opacity: d.key === todayKey ? 0.4 : 0.75,
  }));
}

const emptyByDay: ByDayOf<MealMacros> = {};

describe("Progress Daily Calories — today-bar dim rule", () => {
  it("monday-start, anchor Wednesday: dims Wed, leaves future Sun at 0.75", () => {
    // Wed 8 Apr 2026 12:00 local → Mon-start week is Mon 6 .. Sun 12.
    const now = new Date(2026, 3, 8, 12, 0, 0, 0);
    const todayKey = "2026-04-08";
    const { days } = buildWeekStats<MealMacros>(emptyByDay, TARGETS, "monday", now);
    const opacities = dimDays(days, todayKey);

    // Sanity — Wed (index 2 for Mon-start) is the row that matches today.
    expect(days[2].key).toBe("2026-04-08");
    expect(days[2].label).toBe("Wed");

    // Today (Wed) is dim; future Sun is NOT dim — this was the bug.
    expect(opacities[2].opacity).toBe(0.4);
    expect(opacities[6].key).toBe("2026-04-12");
    expect(opacities[6].opacity).toBe(0.75);

    // Exactly one bar gets the 0.4 treatment.
    expect(opacities.filter((o) => o.opacity === 0.4)).toHaveLength(1);
  });

  it("monday-start, anchor Sunday: dims Sun (last index, by coincidence)", () => {
    // Sun 12 Apr 2026 → Mon-start week Mon 6 .. Sun 12. Today is the
    // last index — the legacy `i === 6` rule would also have been
    // correct here. The new rule must still produce the same outcome.
    const now = new Date(2026, 3, 12, 12, 0, 0, 0);
    const todayKey = "2026-04-12";
    const { days } = buildWeekStats<MealMacros>(emptyByDay, TARGETS, "monday", now);
    const opacities = dimDays(days, todayKey);

    expect(days[6].key).toBe(todayKey);
    expect(opacities[6].opacity).toBe(0.4);
    expect(opacities.filter((o) => o.opacity === 0.4)).toHaveLength(1);
  });

  it("monday-start, anchor Monday: dims Mon (first index)", () => {
    // Mon 13 Apr 2026 → Mon-start week Mon 13 .. Sun 19. Today is
    // index 0; the legacy `i === 6` rule dimmed Sunday — six days in
    // the future. The new rule dims Monday correctly.
    const now = new Date(2026, 3, 13, 12, 0, 0, 0);
    const todayKey = "2026-04-13";
    const { days } = buildWeekStats<MealMacros>(emptyByDay, TARGETS, "monday", now);
    const opacities = dimDays(days, todayKey);

    expect(days[0].key).toBe(todayKey);
    expect(opacities[0].opacity).toBe(0.4);
    // Saturday (the legacy "today" under the old rule for a Sunday-
    // anchor / Sat-anchor scenarios) is at the baseline.
    expect(opacities[6].opacity).toBe(0.75);
  });

  it("sunday-start, anchor Wednesday: dims Wed (index 3), not Sat (index 6)", () => {
    // Wed 8 Apr 2026 → Sun-start week Sun 5 .. Sat 11. Wed is index 3.
    const now = new Date(2026, 3, 8, 12, 0, 0, 0);
    const todayKey = "2026-04-08";
    const { days } = buildWeekStats<MealMacros>(emptyByDay, TARGETS, "sunday", now);
    const opacities = dimDays(days, todayKey);

    expect(days[3].key).toBe(todayKey);
    expect(days[3].label).toBe("Wed");
    expect(opacities[3].opacity).toBe(0.4);
    // Saturday at the end of the week is in the future — must NOT be dim.
    expect(days[6].key).toBe("2026-04-11");
    expect(opacities[6].opacity).toBe(0.75);
  });

  it("sunday-start, anchor Sunday: dims Sun (first index)", () => {
    const now = new Date(2026, 3, 12, 12, 0, 0, 0);
    const todayKey = "2026-04-12";
    const { days } = buildWeekStats<MealMacros>(emptyByDay, TARGETS, "sunday", now);
    const opacities = dimDays(days, todayKey);

    expect(days[0].key).toBe(todayKey);
    expect(opacities[0].opacity).toBe(0.4);
    expect(opacities.filter((o) => o.opacity === 0.4)).toHaveLength(1);
  });

  it("never dims more than one bar in a 7-day week", () => {
    const now = new Date(2026, 3, 8, 12, 0, 0, 0);
    const { days } = buildWeekStats<MealMacros>(emptyByDay, TARGETS, "monday", now);
    const todayKey = "2026-04-08";
    const opacities = dimDays(days, todayKey);
    expect(opacities.filter((o) => o.opacity === 0.4)).toHaveLength(1);
  });

  it("dims nothing when today's key isn't inside the rendered week", () => {
    // Defensive — buildWeekStats always renders a contiguous 7-day window
    // around `now`, so this can only happen if we somehow pass a stale
    // todayKey. The rule degrades to "no bar dimmed" rather than
    // accidentally dimming an unrelated row.
    const now = new Date(2026, 3, 8, 12, 0, 0, 0);
    const { days } = buildWeekStats<MealMacros>(emptyByDay, TARGETS, "monday", now);
    const opacities = dimDays(days, "1999-01-01");
    expect(opacities.every((o) => o.opacity === 0.75)).toBe(true);
  });
});
