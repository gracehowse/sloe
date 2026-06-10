// @vitest-environment jsdom
/**
 * CalorieRing — `goal <= 0` no-profile case renders the calibrating-
 * empty state (audit R03, 2026-05-05).
 *
 * Cross-platform contradiction caught by the depth audit: with
 * `goal=0, consumed=500` the mobile ring rendered a gradient stroke +
 * "LOGGED 500 / of 0 kcal" while the web `DailyRing` rendered
 * destructive red + "OVER 500 / of 0 kcal". Same input, opposite
 * colour. Fix: both platforms now treat `goal <= 0` as empty (no
 * profile target yet) and render the "Start your day" calibrating
 * state until the host passes a real target.
 *
 * Mirror of `tests/unit/dailyRing.test.tsx` "R03" suite — same
 * fixtures, same assertions. Tested via the TodayHeroRing wrapper
 * (the SVG/Reanimated bits in CalorieRing are easier to render
 * through a wrapper test that already works in the suite).
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayHeroRing } from "../../components/today/TodayHeroRing";

void React;

const baseProps = {
  baseGoal: 2000,
  textColor: "#000",
  secondaryColor: "#666",
  trackColor: "#ddd",
  cardBackgroundColor: "#fff",
  borderColor: "#eee",
  textTertiaryColor: "#999",
  proteinPct: 0.5,
  carbsPct: 0.5,
  fatPct: 0.5,
  expanded: false,
  onToggleExpanded: () => {},
  onToggleDisplayMode: () => {},
} as const;

describe("CalorieRing — R03 goal<=0 calibrating-empty state", () => {
  it("renders 'Start your day' instead of OVER when goal=0 and consumed>0", () => {
    const { queryByText } = render(
      <TodayHeroRing
        {...baseProps}
        consumed={500}
        goal={0}
        displayMode="remaining"
      />,
    );
    expect(queryByText("Start your day")).not.toBeNull();
    // Must NOT render the OVER copy or the "of 0 kcal" budget anchor.
    expect(queryByText(/^OVER$/i)).toBeNull();
    expect(queryByText(/of\s+0\s+kcal/i)).toBeNull();
  });

  it("renders 'Start your day' when goal=0 and consumed=0 (cold start, no profile)", () => {
    const { queryByText } = render(
      <TodayHeroRing
        {...baseProps}
        consumed={0}
        goal={0}
        displayMode="remaining"
      />,
    );
    expect(queryByText("Start your day")).not.toBeNull();
  });

  it("hides the budget line when goal<=0", () => {
    const { queryByText } = render(
      <TodayHeroRing
        {...baseProps}
        consumed={0}
        goal={0}
        displayMode="remaining"
      />,
    );
    expect(queryByText(/of\s+0\s+kcal/i)).toBeNull();
  });

  it("renders normally once goal>0 (no regression on the common case)", () => {
    const { queryByText } = render(
      <TodayHeroRing
        {...baseProps}
        consumed={500}
        goal={2000}
        displayMode="remaining"
      />,
    );
    expect(queryByText("Start your day")).toBeNull();
    // Sloe redesign (2026-06-04, "match Figma exactly"): in REMAINING mode
    // the centre sub-label is now the budget line "of {goal} kcal" (Figma
    // `01 · Today`), replacing the old uppercase "REMAINING" status word.
    // The common case (goal>0, under budget) must render this budget anchor
    // — and must NOT show the "of 0 kcal" cold-start anchor or the empty
    // copy. Asserting the real "of 2,000 kcal" centre line keeps this a
    // meaningful no-regression check on the populated ring.
    expect(queryByText("of 2,000 kcal")).not.toBeNull();
    expect(queryByText(/of\s+0\s+kcal/i)).toBeNull();
  });
});
