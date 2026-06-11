// @vitest-environment jsdom
/**
 * TodayHeroRing — SLOE hero chrome (redesign 2026-06-03, `01 · Today`).
 *
 * Protects the re-skinned hero card composition that wraps the ring:
 *   - the status CHIP above the ring (calm copy, three states), and
 *   - the Goal / Eaten / Bonus(or Over) stats row below it.
 *
 * Chip copy matches Figma `01 · Today`: Fresh start / Under budget /
 * Over budget (`todayStatusChip` in `src/lib/copy/today.ts`).
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

  it("under target → 'Under budget' chip", () => {
    const { getByText } = render(
      <TodayHeroRing {...baseProps} consumed={1200} goal={2000} />,
    );
    expect(getByText("Under budget")).toBeTruthy();
  });

  it("over target → 'Over budget' chip", () => {
    const { getByText } = render(
      <TodayHeroRing {...baseProps} consumed={2400} goal={2000} />,
    );
    expect(getByText("Over budget")).toBeTruthy();
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

  it("keeps Bonus as the third stat even when over budget (Grace 2026-06-10)", () => {
    // The over amount already reads in the centre + the status chip; the
    // old slot-flip hid the earned-burn number exactly when an over-budget
    // user most wants it.
    const { getByText, queryByText } = render(
      <TodayHeroRing {...baseProps} consumed={2400} goal={2000} baseGoal={1800} />,
    );
    expect(getByText("Bonus")).toBeTruthy();
    expect(getByText("+200")).toBeTruthy();
    expect(queryByText("Over")).toBeNull();
  });

  it("renders the stats row on the EMPTY hero too — zeros are honest (Grace 2026-06-10)", () => {
    // Supersedes the calm-empty divergence: the empty page mirrors
    // populated days; Eaten 0 / Bonus +0 are numbers, not noise.
    const { getByText, getAllByText } = render(
      <TodayHeroRing {...baseProps} consumed={0} goal={2000} />,
    );
    expect(getByText("Goal")).toBeTruthy();
    expect(getByText("Eaten")).toBeTruthy();
    expect(getAllByText("0").length).toBeGreaterThanOrEqual(1);
  });
});
