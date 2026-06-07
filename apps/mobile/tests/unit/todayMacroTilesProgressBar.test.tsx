// @vitest-environment jsdom
/**
 * TodayDashboardMacroTiles — per-tile progress bar (RE-ADDED 2026-06-04,
 * Grace measured-spec pass against the Stitch `today.html` reference).
 *
 * The thin macro-coloured bar under each tile's value row was the founder's
 * #1 structural gap: the mock tiles carry a `h-1 … rounded-full` bar (a
 * frost-mist track + macro-colour fill at %-width), but it had been dropped
 * in the interim "Figma 01" pass. This test renders the tiles and pins the
 * bar back as OBSERVABLE behaviour, so removing it again breaks CI:
 *   - every tracked macro renders its bar element, and
 *   - the fill width reflects min(current/target, 1), and
 *   - reference-only macros (sugar/sodium — generic reference, not a
 *     personal target) render a DE-EMPHASISED fill so the bar never reads as
 *     a hit goal.
 *
 * Harness mirrors `todayHeroRingSloeChipStats.test.tsx` (jsdom +
 * @testing-library/react-native, no provider). This test asserts only the
 * progress-bar behaviour; the tile's resting-card elevation (now an
 * unconditional soft lift via `useCardElevation`) is covered separately by
 * `cardElevationVariants.test.tsx`.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayDashboardMacroTiles } from "../../components/today/TodayDashboardMacroTiles";

void React;

const baseProps = {
  totals: { protein: 96, carbs: 142, fat: 44, fiber: 18 },
  targets: { protein: 140, carbs: 200, fat: 68, fiber: 30 },
  totalWaterMl: 0,
  waterGoalMl: 2000,
  mealsToday: [],
  onPressMacro: () => {},
  cardColor: "#F6F5F2",
  cardBorderColor: "#E8E2EC",
  borderColor: "#E8E2EC",
  textColor: "#221B26",
  textSecondaryColor: "#6A6072",
  textTertiaryColor: "#9B93A3",
  mutedColor: "#E8E2EC",
};

/** Pull the inner fill View out of a tile's bar (the bar is the single child
 *  of the testID'd track). */
function fillStyle(barNode: { props: { children?: unknown } }) {
  const child = (barNode.props.children as { props?: { style?: unknown } }) ?? {};
  return (child.props?.style ?? {}) as {
    width?: string;
    opacity?: number;
    backgroundColor?: string;
  };
}

describe("TodayDashboardMacroTiles — per-tile progress bar", () => {
  it("renders a progress bar for each tracked macro", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...baseProps}
        trackedMacros={["protein", "carbs", "fat", "fiber"]}
      />,
    );
    for (const macro of ["protein", "carbs", "fat", "fiber"]) {
      expect(getByTestId(`today-macro-tile-bar-${macro}`)).toBeTruthy();
    }
  });

  it("fills the bar to min(current/target, 1) as a percentage width", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...baseProps}
        trackedMacros={["protein"]}
      />,
    );
    // 96 / 140 = 68.57% → the fill width is the unclamped ratio * 100.
    const fill = fillStyle(getByTestId("today-macro-tile-bar-protein"));
    expect(fill.width).toBe(`${(96 / 140) * 100}%`);
    // Identity colour (olive-sage protein), full opacity — a real target.
    expect(fill.opacity).toBe(1);
  });

  it("clamps an over-target macro fill at 100% (over signalling is the ring's job)", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...baseProps}
        totals={{ protein: 210, carbs: 0, fat: 0, fiber: 0 }}
        targets={{ protein: 140, carbs: 200, fat: 68, fiber: 30 }}
        trackedMacros={["protein"]}
      />,
    );
    const fill = fillStyle(getByTestId("today-macro-tile-bar-protein"));
    expect(fill.width).toBe("100%");
  });

  it("renders a reference-only macro (sugar) bar with a de-emphasised fill", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...baseProps}
        trackedMacros={["sugar"]}
      />,
    );
    const bar = getByTestId("today-macro-tile-bar-sugar");
    expect(bar).toBeTruthy();
    // Reference-only → quieter fill so it never reads as a hit personal goal.
    expect(fillStyle(bar).opacity).toBe(0.45);
  });
});
