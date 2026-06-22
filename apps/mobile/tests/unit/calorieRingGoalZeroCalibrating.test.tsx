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
    // 2026-06-10 (Grace): soft-empty copy retired — real numbers always.
    // With no goal there is no verdict: LOGGED, never OVER.
    expect(queryByText("LOGGED")).not.toBeNull();
    expect(queryByText(/^OVER$/)).toBeNull();
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
    // 2026-06-10: numbers always — cold start reads "0 LOGGED".
    expect(queryByText("LOGGED")).not.toBeNull();
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
    // The Today hero now defaults to the v3 `CalorieRingDial` (the
    // `sloe_v3_ring` flag is default-ON). With a real target and under
    // budget, the dial's centre verdict reads the remaining kcal value over
    // a static "KCAL LEFT" label (never "OVER", never the "of 0 kcal"
    // cold-start anchor). Asserting the label keeps this a meaningful
    // no-regression check on the populated dial without depending on the
    // count-up animation's mid-flight number.
    expect(queryByText("KCAL LEFT")).not.toBeNull();
    expect(queryByText(/of\s+0\s+kcal/i)).toBeNull();
  });
});
