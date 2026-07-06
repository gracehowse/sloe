/**
 * TodayDashboardMacroTiles (web) — serif zero softening (audit gap 8,
 * 2026-06-09; mobile parity).
 *
 * Gap 8: the serif value softens to `text-foreground-tertiary` while the macro
 * is still a zero, so the editorial numeral only earns its full ink weight when
 * there's data.
 *
 * ENG-1356 (flag-collapse sweep, 2026-07-06): `today_tracker_tier_v1` was
 * always-on in production (REDESIGN_DEFAULT_ON) and is now collapsed — the
 * recipe-tier tile (no per-tile caption row; the over/under signal lives in
 * the value colour) is the ONLY tile this component renders. The legacy
 * flag-off caption row (audit gap 4: "N g remaining" / "N g over" / "ref Ng")
 * this file used to pin (by forcing the flag off) no longer exists as a live
 * code path, so those assertions were removed rather than kept alive against
 * dead code.
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import { TodayDashboardMacroTiles } from "../../src/app/components/suppr/today-dashboard-macro-tiles";

const baseProps = {
  trackedMacros: ["protein"],
  proteinCurrent: 96,
  proteinTarget: 140,
  carbsCurrent: 0,
  carbsTarget: 200,
  fatCurrent: 0,
  fatTarget: 68,
  fiberCurrent: 0,
  fiberTarget: 30,
  sugarG: 18,
  sodiumMg: 1100,
  waterCurrentMl: 0,
  waterTargetMl: 2500,
  formatWaterLine: (ml: number) => `${(ml / 1000).toFixed(1)} L`,
  onAddWaterMl: () => {},
};

describe("TodayDashboardMacroTiles (web) — no per-tile caption row (ENG-1356 collapse)", () => {
  it("renders no caption element — the recipe-tier tile signals via value colour only", () => {
    const { queryByTestId } = render(<TodayDashboardMacroTiles {...baseProps} />);
    expect(queryByTestId("today-macro-tile-caption-protein")).toBeNull();
  });
});

describe("TodayDashboardMacroTiles (web) — serif zero softening (gap 8)", () => {
  it("renders the serif value in full ink when the macro has data", () => {
    const { container } = render(<TodayDashboardMacroTiles {...baseProps} />);
    const value = container.querySelector(".font-\\[family-name\\:var\\(--font-headline\\)\\]");
    expect(value?.className).toMatch(/text-foreground\b/);
    expect(value?.className).not.toMatch(/text-foreground-tertiary/);
  });

  it("softens the serif value to muted while the macro is a zero", () => {
    const { container } = render(
      <TodayDashboardMacroTiles {...baseProps} proteinCurrent={0} />,
    );
    const value = container.querySelector(".font-\\[family-name\\:var\\(--font-headline\\)\\]");
    expect(value?.className).toMatch(/text-foreground-tertiary/);
  });
});

describe("TodayDashboardMacroTiles (web) — macro-detail entry point", () => {
  it("fires onPressMacro with the tile key when a macro tile is tapped", () => {
    const onPressMacro = vi.fn();
    const { getByTestId } = render(
      <TodayDashboardMacroTiles {...baseProps} onPressMacro={onPressMacro} />,
    );
    fireEvent.click(getByTestId("today-macro-tile-protein"));
    expect(onPressMacro).toHaveBeenCalledWith("protein");
  });

  it("renders a real button with an accessible breakdown label when wired", () => {
    const { getByRole } = render(
      <TodayDashboardMacroTiles {...baseProps} onPressMacro={() => undefined} />,
    );
    expect(getByRole("button", { name: "Open Protein breakdown" })).toBeTruthy();
  });
});
