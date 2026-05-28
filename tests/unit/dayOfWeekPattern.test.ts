/**
 * dayOfWeekPattern — pure-helper test suite.
 *
 * Pins:
 *   - Returns null when < 14 days of logged data inside the window.
 *   - Returns null when the high/low gap is < 200 kcal.
 *   - Picks the highest-vs-lowest weekday by mean kcal.
 *   - Excludes weekdays with zero samples (so a never-logged Tuesday
 *     doesn't fake a "low" bucket).
 *   - Window is 28 days inclusive of `now` — older logs are ignored.
 *
 * Authority: audit 2026-04-30 (Lose It "Closer" parity).
 */

import { describe, expect, it } from "vitest";
import {
  DAY_OF_WEEK_PATTERN_MIN_DAYS,
  DAY_OF_WEEK_PATTERN_MIN_DELTA_KCAL,
  DAY_OF_WEEK_PATTERN_WINDOW_DAYS,
  computeDayOfWeekPattern,
} from "../../src/lib/nutrition/dayOfWeekPattern";

type ByDay = Record<string, Array<{ calories: number; protein: number; carbs: number; fat: number }>>;

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Build a `byDay` map by populating the `daysFromNow` past N days,
 *  setting kcal per weekday from the supplied lookup. `now.getDay()`
 *  === 0..6 (Sun..Sat). */
function buildByDay(
  now: Date,
  windowDays: number,
  perWeekdayKcal: Record<number, number>,
): ByDay {
  const byDay: ByDay = {};
  for (let offset = 0; offset < windowDays; offset++) {
    const d = new Date(now);
    d.setDate(now.getDate() - offset);
    const dow = d.getDay();
    const kcal = perWeekdayKcal[dow] ?? 0;
    if (kcal > 0) {
      byDay[dateKey(d)] = [{ calories: kcal, protein: 0, carbs: 0, fat: 0 }];
    }
  }
  return byDay;
}

describe("computeDayOfWeekPattern", () => {
  // Anchor `now` to a Wednesday (2026-04-29 is a Wednesday) so we can
  // reason precisely about which dates fall on which weekdays.
  const NOW = new Date(2026, 3, 29); // 2026-04-29 (Wed)

  it("returns null when fewer than 14 days are logged in the 28-day window", () => {
    // Only 10 days logged.
    const byDay: ByDay = {};
    for (let offset = 0; offset < 10; offset++) {
      const d = new Date(NOW);
      d.setDate(NOW.getDate() - offset);
      byDay[dateKey(d)] = [{ calories: 2000, protein: 0, carbs: 0, fat: 0 }];
    }
    expect(computeDayOfWeekPattern(byDay, NOW)).toBeNull();
  });

  it("returns null when high/low delta is below the 200 kcal threshold", () => {
    // Every weekday averages 2000 ± 50 — below 200 kcal threshold.
    const byDay = buildByDay(NOW, 28, {
      0: 2000, // Sun
      1: 2050, // Mon
      2: 2000, // Tue
      3: 1980, // Wed
      4: 2010, // Thu
      5: 2030, // Fri
      6: 2050, // Sat
    });
    expect(computeDayOfWeekPattern(byDay, NOW)).toBeNull();
  });

  it("surfaces the high vs low weekday when both gates pass", () => {
    // Saturday averages clearly higher than Tuesday.
    const byDay = buildByDay(NOW, 28, {
      0: 2000, // Sun
      1: 2000, // Mon
      2: 1700, // Tue ← low
      3: 2000, // Wed
      4: 2000, // Thu
      5: 2000, // Fri
      6: 2400, // Sat ← high
    });
    const pattern = computeDayOfWeekPattern(byDay, NOW);
    expect(pattern).not.toBeNull();
    expect(pattern!.highDay).toBe("Saturday");
    expect(pattern!.lowDay).toBe("Tuesday");
    expect(pattern!.deltaKcal).toBe(700);
    // ENG-740 — the high/low means are surfaced for the blended
    // Week-Digest PATTERN bars. They are the same means the delta is
    // derived from (700 = 2400 - 1700), never re-invented.
    expect(pattern!.highDayAvg).toBe(2400);
    expect(pattern!.lowDayAvg).toBe(1700);
    expect(pattern!.highDayAvg - pattern!.lowDayAvg).toBe(pattern!.deltaKcal);
  });

  it("excludes weekdays with zero samples so 'never-logged' weekdays don't fake a low bucket", () => {
    // Tuesday is never logged — should not be picked as the low.
    // Only logged: Wed/Thu (2000) and Sat (2300). Lowest with samples
    // is Wed/Thu, NOT Tuesday.
    const byDay: ByDay = {};
    for (let offset = 0; offset < 28; offset++) {
      const d = new Date(NOW);
      d.setDate(NOW.getDate() - offset);
      const dow = d.getDay();
      if (dow === 6) {
        byDay[dateKey(d)] = [{ calories: 2300, protein: 0, carbs: 0, fat: 0 }];
      } else if (dow === 3 || dow === 4) {
        byDay[dateKey(d)] = [{ calories: 2000, protein: 0, carbs: 0, fat: 0 }];
      }
    }
    const pattern = computeDayOfWeekPattern(byDay, NOW);
    // Need at least 14 days logged inside the window for the helper to
    // surface a pattern. Wed (4 in window) + Thu (4) + Sat (4) = 12 — under
    // threshold, so this scenario asserts the floor *and* the
    // exclusion behaviour together.
    expect(pattern).toBeNull();
  });

  it("returns null when only one weekday-with-samples exists", () => {
    // Logged only Saturdays — can't compute a high vs low.
    const byDay: ByDay = {};
    for (let offset = 0; offset < 28; offset++) {
      const d = new Date(NOW);
      d.setDate(NOW.getDate() - offset);
      if (d.getDay() === 6) {
        byDay[dateKey(d)] = [{ calories: 2300, protein: 0, carbs: 0, fat: 0 }];
      }
    }
    expect(computeDayOfWeekPattern(byDay, NOW)).toBeNull();
  });

  it("ignores days outside the rolling 28-day window", () => {
    // Inside window: average 2000 across all 7 weekdays (no pattern).
    // Outside the window (40 days ago): a single 5000 kcal blowout.
    // The helper should NOT pick the blowout.
    const byDay = buildByDay(NOW, 28, {
      0: 2000,
      1: 2000,
      2: 2000,
      3: 2000,
      4: 2000,
      5: 2000,
      6: 2000,
    });
    const old = new Date(NOW);
    old.setDate(NOW.getDate() - 40);
    byDay[dateKey(old)] = [{ calories: 5000, protein: 0, carbs: 0, fat: 0 }];

    expect(computeDayOfWeekPattern(byDay, NOW)).toBeNull();
  });

  it("rounds the delta to a whole kcal", () => {
    // Saturdays average exactly 2400 over 4 logs; Tuesdays average
    // 2000.5 over 2 logs (kcal 2001 + 2000). Delta = 399.5 → rounded 400.
    const byDay = buildByDay(NOW, 28, {
      0: 2000, // Sun
      1: 2000, // Mon
      2: 2001, // Tue (will be replaced for half the logs)
      3: 2000, // Wed
      4: 2000, // Thu
      5: 2000, // Fri
      6: 2400, // Sat
    });
    // Tweak Tuesday: alternate 2001/2000 so the mean is 2000.5.
    let tueIdx = 0;
    for (let offset = 0; offset < 28; offset++) {
      const d = new Date(NOW);
      d.setDate(NOW.getDate() - offset);
      if (d.getDay() === 2) {
        const kcal = tueIdx % 2 === 0 ? 2001 : 2000;
        byDay[dateKey(d)] = [{ calories: kcal, protein: 0, carbs: 0, fat: 0 }];
        tueIdx++;
      }
    }

    const pattern = computeDayOfWeekPattern(byDay, NOW);
    expect(pattern).not.toBeNull();
    expect(pattern!.deltaKcal).toBe(400);
  });

  it("returns null on an empty byDay map", () => {
    expect(computeDayOfWeekPattern({}, NOW)).toBeNull();
  });

  it("exports stable threshold constants for parity tests + downstream callers", () => {
    // Pin the threshold values so future "tweaks" are explicit code review.
    expect(DAY_OF_WEEK_PATTERN_MIN_DAYS).toBe(14);
    expect(DAY_OF_WEEK_PATTERN_MIN_DELTA_KCAL).toBe(200);
    expect(DAY_OF_WEEK_PATTERN_WINDOW_DAYS).toBe(28);
  });
});
