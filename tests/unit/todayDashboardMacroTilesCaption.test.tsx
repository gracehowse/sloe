/**
 * TodayDashboardMacroTiles (web) — per-tile caption + serif zero softening
 * (audit gaps 4 + 8, 2026-06-09; mobile parity).
 *
 * Gap 4: each tile shows the spec'd caption under the bar (today.md §3.3/§4 —
 * the at-a-glance "how much left" warm-coaching payoff):
 *   - under target → "N g remaining" in sage (`text-success`)
 *   - over target  → "N g over" in amber (`--accent-warning-solid`, AA-safe)
 *   - reference-only (sugar/sodium) → muted "ref N"
 *   - unlogged (current = 0) → full target as "N g remaining" (ENG-938 — refugee scannable gap)
 * The copy is the canonical "remaining" (matches mobile so the two surfaces
 * can't drift).
 *
 * Gap 8: the serif value softens to `text-foreground-tertiary` while the macro
 * is still a zero, so the editorial numeral only earns its full ink weight when
 * there's data.
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

// ENG-1099: the per-tile bar + caption are the LEGACY (flag-off) path — the
// recipe-tier tile (today_tracker_tier_v1, default-on) drops them and moves the
// signal onto the value colour. Force the flag OFF here so these tests exercise
// the legacy caption they're about; a separate describe covers the tier-on case.
vi.mock("../../src/lib/analytics/track", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/analytics/track")>()),
  isFeatureEnabled: (flag: string) =>
    flag === "today_tracker_tier_v1" ? false : true,
}));

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

describe("TodayDashboardMacroTiles (web) — per-tile caption (gap 4)", () => {
  it('shows "N g remaining" (sage) under target', () => {
    const { getByTestId } = render(<TodayDashboardMacroTiles {...baseProps} />);
    const cap = getByTestId("today-macro-tile-caption-protein");
    expect(cap.textContent).toBe("44g remaining");
    expect(cap.className).toMatch(/text-success/);
  });

  it('shows "N g over" (amber) over target', () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles {...baseProps} proteinCurrent={210} />,
    );
    const cap = getByTestId("today-macro-tile-caption-protein");
    expect(cap.textContent).toBe("70g over");
    // Amber as text uses the AA-safe solid token (inline style).
    expect((cap as HTMLElement).style.color).toBe("var(--accent-warning-solid)");
  });

  it("shows a muted 'ref' caption for reference-only macros (sugar)", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles {...baseProps} trackedMacros={["sugar"]} />,
    );
    const cap = getByTestId("today-macro-tile-caption-sugar");
    expect(cap.textContent).toBe("ref 50g");
    expect(cap.className).toMatch(/text-foreground-tertiary/);
  });

  it('shows full remaining on an unlogged tile (current = 0) — ENG-938', () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles {...baseProps} proteinCurrent={0} />,
    );
    const cap = getByTestId("today-macro-tile-caption-protein");
    expect(cap.textContent).toBe("140g remaining");
    expect(cap.className).toMatch(/text-success/);
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
