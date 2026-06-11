import { describe, expect, it } from "vitest";
import {
  PLAN_SUMMARY_HIT_BAND,
  buildPlanWeekSummarySubtitle,
  computePlanWeekSummaryScore,
  planWeekHeadlineTone,
  type PlanSummaryDay,
} from "../../src/lib/planning/planWeekSummary.ts";

/**
 * Prototype port (2026-04-20) — these tests pin the "Hits your targets
 * N of M days" summary card behaviour that's shared between web and
 * mobile. The mobile file (`apps/mobile/app/(tabs)/planner.tsx`)
 * computes the same thing inline via a `useMemo`; web consumes this
 * helper from `MealPlanner.tsx`. Regressions on either side flip the
 * card's copy, which is user-visible, so we pin:
 *   - the ±10% hit definition
 *   - the worst-short-day selection rule
 *   - the three subtitle branches (all hit / short day / over target)
 *   - guard rails (empty plan, zero / unset target, NaN day totals)
 */

function day(calories: number): PlanSummaryDay {
  return { totals: { calories } };
}

describe("computePlanWeekSummaryScore", () => {
  it("returns null on empty or missing plan", () => {
    expect(computePlanWeekSummaryScore(null, 2000)).toBeNull();
    expect(computePlanWeekSummaryScore(undefined, 2000)).toBeNull();
    expect(computePlanWeekSummaryScore([], 2000)).toBeNull();
  });

  it("returns null on non-positive or non-finite target", () => {
    expect(computePlanWeekSummaryScore([day(1800)], 0)).toBeNull();
    expect(computePlanWeekSummaryScore([day(1800)], -100)).toBeNull();
    expect(computePlanWeekSummaryScore([day(1800)], Number.NaN)).toBeNull();
    expect(computePlanWeekSummaryScore([day(1800)], Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("counts hits only for at-or-under-target days within the 10% band (ENG-1049)", () => {
    const target = 2000;
    // On target, just-inside -10%, hot over (even inside old +10%), cold under
    const plan = [day(2000), day(2200), day(1800), day(2201), day(1799)];
    const score = computePlanWeekSummaryScore(plan, target);
    expect(score).not.toBeNull();
    // 2 hits (on target + 1800 under), 3 misses (over days + 1799 too far under).
    expect(score?.hits).toBe(2);
    expect(score?.total).toBe(5);
  });

  it("treats the lower band boundary as a hit but not the upper (ENG-1049)", () => {
    const target = 2000;
    const atLowerBand = day(2000 - 2000 * PLAN_SUMMARY_HIT_BAND);
    const atUpperBand = day(2000 + 2000 * PLAN_SUMMARY_HIT_BAND);
    const score = computePlanWeekSummaryScore([atLowerBand, atUpperBand], target);
    expect(score?.hits).toBe(1);
  });

  it("does not award 7/7 when every day is over target (ENG-1049)", () => {
    const target = 2000;
    const plan = Array.from({ length: 7 }, () => day(2100));
    const score = computePlanWeekSummaryScore(plan, target)!;
    expect(score.hits).toBe(0);
    expect(planWeekHeadlineTone(score)).not.toBe("win");
  });

  it("picks the day with the largest negative calorie gap as worstShort", () => {
    const target = 2000;
    // Day 0 is 400 kcal over, Day 1 is 180 kcal short, Day 2 is 500 kcal short,
    // Day 3 is on target. worstShort should point at Day 2.
    const plan = [day(2400), day(1820), day(1500), day(2000)];
    const score = computePlanWeekSummaryScore(plan, target);
    expect(score?.worstShort).toEqual({ dayIndex: 2, shortBy: 500 });
  });

  it("returns worstShort null when no day is under target", () => {
    const target = 2000;
    const score = computePlanWeekSummaryScore([day(2000), day(2100), day(2300)], target);
    expect(score?.worstShort).toBeNull();
  });

  it("handles missing / NaN day totals defensively (treats as 0 short)", () => {
    const target = 2000;
    const plan: PlanSummaryDay[] = [
      { totals: { calories: Number.NaN } },
      { totals: { calories: 2000 } },
    ];
    const score = computePlanWeekSummaryScore(plan, target);
    // NaN day: total coerces to 0 → diff -2000 → counts as worst short.
    expect(score?.hits).toBe(1);
    expect(score?.worstShort?.dayIndex).toBe(0);
    expect(score?.worstShort?.shortBy).toBe(2000);
  });

  it("scales total to plan length regardless of whether it is 1 / 3 / 7 days", () => {
    const target = 2000;
    expect(computePlanWeekSummaryScore([day(2000)], target)?.total).toBe(1);
    expect(computePlanWeekSummaryScore([day(2000), day(2000), day(2000)], target)?.total).toBe(3);
    expect(
      computePlanWeekSummaryScore(
        Array.from({ length: 7 }, () => day(2000)),
        target,
      )?.total,
    ).toBe(7);
  });
});

describe("buildPlanWeekSummarySubtitle", () => {
  it("returns the all-days-land copy when hits == total (plural)", () => {
    expect(
      buildPlanWeekSummarySubtitle({ hits: 7, total: 7, worstShort: null }, null),
    ).toBe("All 7 days land on target.");
  });

  it("returns the singular all-days-land copy for a 1-day plan", () => {
    expect(
      buildPlanWeekSummarySubtitle({ hits: 1, total: 1, worstShort: null }, null),
    ).toBe("All 1 day land on target.");
  });

  it("returns the short-day diagnostic when one is flagged and a label is provided", () => {
    const subtitle = buildPlanWeekSummarySubtitle(
      { hits: 6, total: 7, worstShort: { dayIndex: 5, shortBy: 178 } },
      "Saturday",
    );
    expect(subtitle).toBe(
      "Saturday is ~178 kcal short. Add a snack or swap the dinner.",
    );
  });

  it("rounds shortBy to a whole number in the diagnostic", () => {
    const subtitle = buildPlanWeekSummarySubtitle(
      { hits: 6, total: 7, worstShort: { dayIndex: 5, shortBy: 179.4 } },
      "Saturday",
    );
    expect(subtitle).toBe(
      "Saturday is ~179 kcal short. Add a snack or swap the dinner.",
    );
  });

  it("falls back to the generic nudge when no short day exists (all days over)", () => {
    expect(
      buildPlanWeekSummarySubtitle({ hits: 3, total: 7, worstShort: null }, null),
    ).toBe("Some days run over target. Tap a meal to swap or adjust the portion.");
  });

  it("falls back to the generic nudge when a short day exists but no label was resolved", () => {
    expect(
      buildPlanWeekSummarySubtitle(
        { hits: 6, total: 7, worstShort: { dayIndex: 5, shortBy: 180 } },
        null,
      ),
    ).toBe("Some days run over target. Tap a meal to swap or adjust the portion.");
  });
});

/**
 * ENG-820 (Plan win-moment) — the headline-tone classifier is the single
 * source of truth that web (`MealPlanner.tsx`) and mobile
 * (`apps/mobile/app/(tabs)/planner.tsx`) both read to colour the
 * "Hits your targets N of 7" headline. Pinning it here guarantees the two
 * platforms can never disagree on which weeks read as a win vs progress vs
 * calm. The colour mapping itself (win → win token, progress → amber, calm →
 * muted) lives per-platform but keys off these exact tones.
 */
describe("planWeekHeadlineTone", () => {
  it("returns 'win' when every day lands on target (hits === total)", () => {
    expect(planWeekHeadlineTone({ hits: 7, total: 7, worstShort: null })).toBe("win");
    expect(planWeekHeadlineTone({ hits: 1, total: 1, worstShort: null })).toBe("win");
    expect(planWeekHeadlineTone({ hits: 3, total: 3, worstShort: null })).toBe("win");
  });

  it("returns 'calm' when no day lands on target yet (hits === 0)", () => {
    expect(
      planWeekHeadlineTone({ hits: 0, total: 7, worstShort: { dayIndex: 0, shortBy: 800 } }),
    ).toBe("calm");
  });

  it("returns 'progress' when some-but-not-all days land", () => {
    expect(
      planWeekHeadlineTone({ hits: 4, total: 7, worstShort: { dayIndex: 2, shortBy: 300 } }),
    ).toBe("progress");
    expect(
      planWeekHeadlineTone({ hits: 6, total: 7, worstShort: { dayIndex: 6, shortBy: 120 } }),
    ).toBe("progress");
  });

  it("returns 'calm' defensively for null / empty / non-positive totals", () => {
    expect(planWeekHeadlineTone(null)).toBe("calm");
    expect(planWeekHeadlineTone(undefined)).toBe("calm");
    expect(planWeekHeadlineTone({ hits: 0, total: 0, worstShort: null })).toBe("calm");
  });

  it("never returns 'win' unless the whole plan lands (guards a 6/7 false-win)", () => {
    expect(planWeekHeadlineTone({ hits: 6, total: 7, worstShort: null })).not.toBe("win");
  });
});
