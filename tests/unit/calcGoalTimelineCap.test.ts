/**
 * Action 13 Item #15 (2026-04-19) — pin the days-to-goal cap.
 *
 * Bug: when the projection exceeded 365 days, `calcGoalTimeline`
 * returned `daysToGoal === null` and the Journey card rendered no
 * time estimate — leaving the user with an obviously incomplete
 * "remaining N kg to go" headline.
 *
 * Fix: when the rate-based projection would exceed `MAX_DAYS_TO_GOAL`
 * (365), the timeline returns `daysToGoal === null` AND
 * `cappedAtMaxDays === true`. The renderer uses that signal to show
 * "More than 1 year at current rate" copy, with the rate continuing
 * to surface in the descriptive line below.
 */
import { describe, expect, it } from "vitest";

import {
  calcGoalTimeline,
  MAX_DAYS_TO_GOAL,
} from "../../src/lib/weightProjection";

describe("calcGoalTimeline > 365 day cap (Item #15)", () => {
  it("MAX_DAYS_TO_GOAL is 365", () => {
    expect(MAX_DAYS_TO_GOAL).toBe(365);
  });

  it("(a) projection within 365 days renders the day count, cappedAtMaxDays=false", () => {
    // Losing 0.5 kg/wk to drop 5 kg → ~70 days.
    const tl = calcGoalTimeline({
      currentWeightKg: 80,
      goalWeightKg: 75,
      weightKgByDay: {
        "2026-04-12": 80.5,
        "2026-04-19": 80.0,
      },
    });
    expect(tl.daysToGoal).not.toBeNull();
    expect(tl.daysToGoal).toBeLessThanOrEqual(MAX_DAYS_TO_GOAL);
    expect(tl.cappedAtMaxDays).toBe(false);
  });

  it("(b) projection past the cap → daysToGoal=null, cappedAtMaxDays=true", () => {
    // Losing 0.1 kg/wk to drop 30 kg → ~2,100 days; well past the cap.
    const tl = calcGoalTimeline({
      currentWeightKg: 100,
      goalWeightKg: 70,
      weightKgByDay: {
        "2026-04-12": 100.1,
        "2026-04-19": 100.0,
      },
    });
    expect(tl.daysToGoal).toBeNull();
    expect(tl.cappedAtMaxDays).toBe(true);
    // Rate is still surfaced so the renderer can show the user their
    // pace and let them do their own math.
    expect(tl.weeklyRateKg).not.toBe(0);
  });

  it("(c) no rate (stalled trend) → daysToGoal=null AND cappedAtMaxDays=false (suppressed)", () => {
    // Both weigh-ins identical → weeklyRateKg ≈ 0 → trend "stalled" →
    // we don't project anything, so cappedAtMaxDays must NOT be true
    // (it's not "more than 1 year", it's "no rate to project from").
    const tl = calcGoalTimeline({
      currentWeightKg: 80,
      goalWeightKg: 75,
      weightKgByDay: {
        "2026-04-12": 80.0,
        "2026-04-19": 80.0,
      },
    });
    expect(tl.daysToGoal).toBeNull();
    expect(tl.cappedAtMaxDays).toBe(false);
    expect(tl.trendDirection).toBe("stalled");
  });

  it("wrong-direction trend → daysToGoal=null AND cappedAtMaxDays=false", () => {
    // User wants to lose 5 kg but is gaining 0.3 kg/wk. Not "more
    // than 1 year" — the math doesn't even land at the goal.
    const tl = calcGoalTimeline({
      currentWeightKg: 80,
      goalWeightKg: 75,
      weightKgByDay: {
        "2026-04-12": 79.7,
        "2026-04-19": 80.0,
      },
    });
    expect(tl.daysToGoal).toBeNull();
    expect(tl.cappedAtMaxDays).toBe(false);
    expect(tl.trendDirection).toBe("gaining");
  });

  // Audit 2026-04-29 papercut #8 — the capped path now preserves the
  // raw projection in `daysToGoalUncapped` so the UI can render a
  // concrete date with a "1+ year out" qualifier rather than the
  // vague "more than a year at current rate" copy.
  describe("daysToGoalUncapped (papercut #8)", () => {
    it("preserves the raw computed days when capped past 365", () => {
      const tl = calcGoalTimeline({
        currentWeightKg: 100,
        goalWeightKg: 70,
        weightKgByDay: {
          "2026-04-12": 100.1,
          "2026-04-19": 100.0,
        },
      });
      expect(tl.cappedAtMaxDays).toBe(true);
      expect(tl.daysToGoal).toBeNull();
      // Losing 0.1 kg/wk to drop 30 kg ≈ 30 / (0.1 / 7) ≈ 2100 days.
      expect(tl.daysToGoalUncapped).not.toBeNull();
      expect(tl.daysToGoalUncapped!).toBeGreaterThan(MAX_DAYS_TO_GOAL);
    });

    it("matches daysToGoal exactly when within the cap", () => {
      const tl = calcGoalTimeline({
        currentWeightKg: 80,
        goalWeightKg: 75,
        weightKgByDay: {
          "2026-04-12": 80.5,
          "2026-04-19": 80.0,
        },
      });
      expect(tl.cappedAtMaxDays).toBe(false);
      expect(tl.daysToGoal).toBe(tl.daysToGoalUncapped);
    });

    it("is null when the rate is too low to project", () => {
      const tl = calcGoalTimeline({
        currentWeightKg: 80,
        goalWeightKg: 75,
        weightKgByDay: {
          "2026-04-12": 80.0,
          "2026-04-19": 80.0,
        },
      });
      expect(tl.daysToGoal).toBeNull();
      expect(tl.daysToGoalUncapped).toBeNull();
      expect(tl.cappedAtMaxDays).toBe(false);
    });
  });
});
