/**
 * TodayDashboardMacroBars — the alternative bar-list macro display
 * shipped 2026-05-17 as a Settings-configurable alternative to the
 * 2×2 emoji-tile grid. Settings → Display → Macro display.
 *
 * Pinned behaviour:
 *   - Renders one row per `trackedMacros` entry, in order.
 *   - Each row shows `Name … <Value> / <Target> <unit>` plus a thin
 *     progress bar whose width matches `value / target` (capped at
 *     100%, clamped to 0% on negative).
 *   - Unknown macro keys are silently skipped (forward-compat with
 *     future profile.tracked_macros values).
 *   - Tapping a row fires the host's `onPressMacro` callback with the
 *     macro key — used to open the per-macro detail view.
 *   - Value spans carry `ph-mask` so PostHog session-replay redacts
 *     the running totals (ENG-534 P1 parity — daily kcal totals are
 *     MEDIUM-class PHI).
 */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { TodayDashboardMacroBars } from "../../src/app/components/suppr/today-dashboard-macro-bars";

const baseProps = {
  trackedMacros: ["protein", "carbs", "fat", "fiber"],
  proteinCurrent: 92,
  proteinTarget: 140,
  carbsCurrent: 168,
  carbsTarget: 180,
  fatCurrent: 48,
  fatTarget: 60,
  fiberCurrent: 22,
  fiberTarget: 30,
  sugarG: 18,
  sodiumMg: 1100,
  waterCurrentMl: 1000,
  waterTargetMl: 2500,
};

describe("TodayDashboardMacroBars", () => {
  it("renders one row per tracked macro in order", () => {
    const { getByTestId } = render(<TodayDashboardMacroBars {...baseProps} />);
    expect(getByTestId("today-macro-bar-protein")).toBeTruthy();
    expect(getByTestId("today-macro-bar-carbs")).toBeTruthy();
    expect(getByTestId("today-macro-bar-fat")).toBeTruthy();
    expect(getByTestId("today-macro-bar-fiber")).toBeTruthy();
  });

  it("shows value / target g (matches the screenshot Grace shared)", () => {
    const { getByTestId } = render(<TodayDashboardMacroBars {...baseProps} />);
    const proteinRow = getByTestId("today-macro-bar-protein");
    // Row text content concatenates name + value + " / " + target + " " + unit.
    expect(proteinRow.textContent).toContain("Protein");
    expect(proteinRow.textContent).toContain("92");
    expect(proteinRow.textContent).toContain("140");
    expect(proteinRow.textContent).toContain("g");
  });

  it("silently skips unknown macro keys", () => {
    const { queryByTestId } = render(
      <TodayDashboardMacroBars
        {...baseProps}
        trackedMacros={["protein", "not-a-real-macro", "fat"]}
      />,
    );
    expect(queryByTestId("today-macro-bar-protein")).toBeTruthy();
    expect(queryByTestId("today-macro-bar-not-a-real-macro")).toBeNull();
    expect(queryByTestId("today-macro-bar-fat")).toBeTruthy();
  });

  it("fires onPressMacro with the macro key when a row is tapped", () => {
    const onPressMacro = vi.fn();
    const { getByTestId } = render(
      <TodayDashboardMacroBars {...baseProps} onPressMacro={onPressMacro} />,
    );
    fireEvent.click(getByTestId("today-macro-bar-carbs"));
    expect(onPressMacro).toHaveBeenCalledWith("carbs");
  });

  it("marks value spans with `ph-mask` for session-replay masking parity", () => {
    const { getByTestId } = render(<TodayDashboardMacroBars {...baseProps} />);
    const row = getByTestId("today-macro-bar-protein");
    const masked = row.querySelector(".ph-mask");
    expect(masked).not.toBeNull();
    expect(masked?.textContent).toContain("92");
    expect(masked?.textContent).toContain("140");
  });

  it("caps the bar fill at 100% even when current > target (over-budget)", () => {
    const overProps = { ...baseProps, proteinCurrent: 200, proteinTarget: 140 };
    const { getByTestId } = render(<TodayDashboardMacroBars {...overProps} />);
    const row = getByTestId("today-macro-bar-protein");
    const fill = row.querySelector('div[style*="width"]') as HTMLElement | null;
    // The fill is the inner div with an inline `width: N%` style.
    expect(fill).not.toBeNull();
    expect(fill?.style.width).toBe("100%");
  });

  it("renders a 0% fill when target is 0 (no profile target yet)", () => {
    const noTargetProps = { ...baseProps, proteinTarget: 0 };
    const { getByTestId } = render(
      <TodayDashboardMacroBars {...noTargetProps} />,
    );
    const row = getByTestId("today-macro-bar-protein");
    const fill = row.querySelector('div[style*="width"]') as HTMLElement | null;
    expect(fill?.style.width).toBe("0%");
  });
});
