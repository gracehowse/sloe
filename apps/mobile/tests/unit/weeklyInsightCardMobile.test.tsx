// @vitest-environment jsdom
/**
 * WeeklyInsightCard (mobile) — Sloe `TD3 · Weekly insight + Planned` re-skin
 * (Today re-skin unit 3, 2026-06-03). Figma 480:2 /
 * `docs/prototypes/stitch-sloe/today-insight.html`.
 *
 * The TD3 frame turns the card into: a clay sparkle overline, a Newsreader
 * headline, a 3-stat grid (Days logged / Avg intake / On target), a
 * 7-segment week bar, and a coach line. These tests pin:
 *   1. The flag gate — nothing renders when `today-weekly-insight-mobile`
 *      is off (the ENG-754 rollout gate is preserved by the re-skin).
 *   2. The on-target classification (`computeWeekBarStates` /
 *      `computeDaysOnTarget`) uses the CANONICAL calorie band (±4%, min
 *      ±40 kcal) so "on target" can't drift from `classifyDigestHeroTone`.
 *   3. The honest empty state ("Your week starts here" + "Log a meal to
 *      start the week.") and the no-fabrication rule (null avg → "—", no
 *      target → on-target "—").
 *   4. The derived headline + on-target stat for a logged week.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react-native";

import {
  WeeklyInsightCard,
  computeWeekBarStates,
  computeDaysOnTarget,
} from "../../components/today/WeeklyInsightCard";
import { isFeatureEnabled } from "@/lib/analytics";

void React;

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

const COLORS = {
  textColor: "#000",
  textSecondaryColor: "#555",
  cardBackgroundColor: "#fff",
  borderColor: "#eee",
};

describe("computeWeekBarStates / computeDaysOnTarget (TD3 on-target band)", () => {
  it("classifies a day within ±4% (min ±40 kcal) of target as on-target", () => {
    // target 2000 → tolerance 80. 1950 and 2080 are on target, 1800 is not.
    const states = computeWeekBarStates([1950, 2080, 1800, 0, 0, 0, 0], 2000);
    expect(states[0]).toBe("onTarget");
    expect(states[1]).toBe("onTarget");
    expect(states[2]).toBe("loggedOff");
    expect(states[3]).toBe("empty");
  });

  it("uses the ±40 kcal floor for small targets", () => {
    // target 500 → 4% = 20, floored to 40. 530 is within 40 → on target.
    const states = computeWeekBarStates([530, 560, 0, 0, 0, 0, 0], 500);
    expect(states[0]).toBe("onTarget"); // |530-500| = 30 ≤ 40
    expect(states[1]).toBe("loggedOff"); // |560-500| = 60 > 40
  });

  it("treats every logged day as off-target when no target is set", () => {
    const states = computeWeekBarStates([1800, 2000, 0, 0, 0, 0, 0], 0);
    expect(states[0]).toBe("loggedOff");
    expect(states[1]).toBe("loggedOff");
    expect(states[2]).toBe("empty");
  });

  it("counts on-target days and only ever inspects 7 days", () => {
    const count = computeDaysOnTarget([2000, 2000, 2000, 9999, 9999, 9999, 9999, 2000], 2000);
    // The 8th day (2000, on-target) is sliced off; 3 on-target in the window.
    expect(count).toBe(3);
  });
});

describe("WeeklyInsightCard (mobile) — TD3 render", () => {
  beforeEach(() => {
    flagFn.mockReset();
  });

  it("renders nothing when the flag is off", () => {
    flagFn.mockReturnValue(false);
    const { toJSON } = render(
      <WeeklyInsightCard
        householdSize={1}
        loggedDaysInWeek={3}
        weekAvgKcal={1800}
        weekDailyKcal={[1800, 1900, 1700, 0, 0, 0, 0]}
        dailyKcalTarget={2000}
        {...COLORS}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders the honest empty-week state with no fabricated values", () => {
    flagFn.mockReturnValue(true);
    const { getByText, queryByText } = render(
      <WeeklyInsightCard
        householdSize={1}
        loggedDaysInWeek={0}
        weekAvgKcal={null}
        weekDailyKcal={[0, 0, 0, 0, 0, 0, 0]}
        dailyKcalTarget={2000}
        {...COLORS}
      />,
    );
    // Calm honest headline — not the fabricated "trending right" claim.
    expect(getByText("Your week starts here")).toBeTruthy();
    expect(getByText(/Log a meal to start the week\./)).toBeTruthy();
    // No coach line + no daily-average claim when the week has no logged day.
    expect(queryByText(/daily average/)).toBeNull();
    expect(queryByText(/on target so far/)).toBeNull();
  });

  it("renders the days-logged, on-target stat, and derived headline for a logged week", () => {
    flagFn.mockReturnValue(true);
    const { getByTestId, getByText } = render(
      <WeeklyInsightCard
        householdSize={2}
        loggedDaysInWeek={4}
        weekAvgKcal={1840}
        // 3 of 4 logged days on target (target 2000 → tol 80): 1960, 2000,
        // 2040 on target; 1500 off. Days 5-7 empty.
        weekDailyKcal={[1960, 2000, 2040, 1500, 0, 0, 0]}
        dailyKcalTarget={2000}
        {...COLORS}
      />,
    );
    expect(getByTestId("today-weekly-insight-mobile")).toBeTruthy();
    expect(getByText("4 / 7")).toBeTruthy();
    expect(getByText("1,840")).toBeTruthy();
    expect(getByText("3 days")).toBeTruthy(); // on target
    expect(getByText("Planning for 2 this week")).toBeTruthy();
    // 3/4 ≥ 60% on target → the encouraging headline + coach line.
    expect(getByText("Trending right where you want to be")).toBeTruthy();
    expect(getByText("3 of 4 days landed on target — nice.")).toBeTruthy();
  });

  it("shows '—' for on-target when there is no calorie target to judge against", () => {
    flagFn.mockReturnValue(true);
    const { getByText } = render(
      <WeeklyInsightCard
        householdSize={1}
        loggedDaysInWeek={2}
        weekAvgKcal={1700}
        weekDailyKcal={[1700, 1700, 0, 0, 0, 0, 0]}
        dailyKcalTarget={0}
        {...COLORS}
      />,
    );
    // On-target cell is "—" (can't classify without a target) and the
    // headline degrades to the neutral "Your week so far".
    expect(getByText("—")).toBeTruthy();
    expect(getByText("Your week so far")).toBeTruthy();
  });
});
