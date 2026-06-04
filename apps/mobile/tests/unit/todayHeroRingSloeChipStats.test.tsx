// @vitest-environment jsdom
/**
 * TodayHeroRing — SLOE hero chrome (redesign 2026-06-03, `01 · Today`).
 *
 * Protects the re-skinned hero card composition that wraps the ring:
 *   - the status CHIP above the ring (calm copy, three states), and
 *   - the Goal / Eaten / Bonus(or Over) stats row below it.
 *
 * Calm-tone guard: the chip must use the ratified calm phrases
 * ("Fresh start" / "On track" / "{n} over") — NOT the forbidden
 * "under budget" / "over budget" (see `todayCopyParity.test.ts`).
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayHeroRing } from "../../components/today/TodayHeroRing";

void React;

const baseProps = {
  baseGoal: undefined as number | undefined,
  textColor: "#221B26",
  secondaryColor: "#6A6072",
  trackColor: "#EDEAF1",
  cardBackgroundColor: "#F6F5F2",
  borderColor: "#E8E2EC",
  textTertiaryColor: "#9B93A3",
  proteinPct: 0.5,
  carbsPct: 0.5,
  fatPct: 0.5,
  expanded: true,
  onToggleExpanded: () => {},
  onToggleDisplayMode: () => {},
  displayMode: "consumed" as const,
};

describe("TodayHeroRing — SLOE status chip", () => {
  it("empty day → 'Fresh start' chip (no calorie data)", () => {
    const { getByText } = render(
      <TodayHeroRing {...baseProps} consumed={0} goal={2000} />,
    );
    expect(getByText("Fresh start")).toBeTruthy();
  });

  it("under target → 'On track' chip (calm, not 'under budget')", () => {
    const { getByText, queryByText } = render(
      <TodayHeroRing {...baseProps} consumed={1200} goal={2000} />,
    );
    expect(getByText("On track")).toBeTruthy();
    expect(queryByText(/under budget/i)).toBeNull();
  });

  it("over target → '{n} over' chip (calm, not 'over budget')", () => {
    const { getByText, queryByText } = render(
      <TodayHeroRing {...baseProps} consumed={2400} goal={2000} />,
    );
    // 2400 - 2000 = 400 over.
    expect(getByText("400 over")).toBeTruthy();
    expect(queryByText(/over budget/i)).toBeNull();
  });
});

describe("TodayHeroRing — SLOE Goal/Eaten/Bonus stats row", () => {
  it("renders Goal + Eaten labels with thousands-separated values when logged", () => {
    const { getByText, getAllByText } = render(
      <TodayHeroRing {...baseProps} consumed={1420} goal={2040} />,
    );
    expect(getByText("Goal")).toBeTruthy();
    expect(getByText("Eaten")).toBeTruthy();
    expect(getByText("2,040")).toBeTruthy(); // goal (stats row only)
    // Eaten (=consumed) also appears as the ring's centre value in
    // consumed display mode, so it can occur more than once.
    expect(getAllByText("1,420").length).toBeGreaterThanOrEqual(1);
  });

  it("shows a positive Bonus when an exercise bonus lifts the goal", () => {
    const { getByText, getByTestId } = render(
      <TodayHeroRing
        {...baseProps}
        consumed={1420}
        goal={2160}
        baseGoal={2040}
      />,
    );
    // goal - baseGoal = 120 earned headroom.
    expect(getByText("Bonus")).toBeTruthy();
    expect(getByTestId("today-ring-bonus")).toBeTruthy();
    expect(getByText("+120")).toBeTruthy();
  });

  it("flips the third stat to 'Over' (red, negative) when over budget", () => {
    const { getByText, queryByText } = render(
      <TodayHeroRing {...baseProps} consumed={2400} goal={2000} />,
    );
    expect(getByText("Over")).toBeTruthy();
    expect(getByText("−400")).toBeTruthy();
    // The non-over "Bonus" label must not also be present.
    expect(queryByText("Bonus")).toBeNull();
  });

  it("hides the stats row entirely on the empty (calm) hero", () => {
    const { queryByText } = render(
      <TodayHeroRing {...baseProps} consumed={0} goal={2000} />,
    );
    expect(queryByText("Goal")).toBeNull();
    expect(queryByText("Eaten")).toBeNull();
  });
});
