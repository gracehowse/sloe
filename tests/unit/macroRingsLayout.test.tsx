// @vitest-environment jsdom
/**
 * TodayDashboardMacroRings (Sloe v3 macro "Rings" layout) — guards the
 * dropped-`transform` regression: each ring's lit segments must distribute
 * around the dial (distinct transforms), not stack at rotate(0). matchMedia is
 * mocked to reduced-motion so the grow resolves synchronously. Also asserts the
 * `TodayMacroSection` switcher selects the rings variant.
 */
import * as React from "react";
import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { TodayDashboardMacroRings } from "../../src/app/components/suppr/today-dashboard-macro-rings";
import { TodayMacroSection } from "../../src/app/components/suppr/today-macro-section";
import { buildMacroTile } from "../../src/app/components/suppr/today-dashboard-macro-tiles";

void React;

beforeAll(() => {
  // @ts-expect-error — jsdom matchMedia shim (reduced motion → grow resolves sync).
  window.matchMedia = (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
});

function litTransforms(container: HTMLElement): string[] {
  return [...container.querySelectorAll("rect")]
    .filter(
      (r) =>
        (r.getAttribute("fill") ?? "").includes("url(") &&
        Number(r.style.opacity) > 0.9,
    )
    .map((r) => r.getAttribute("transform") ?? "");
}

const BASE_PROPS = {
  trackedMacros: ["protein", "carbs", "fat"],
  proteinCurrent: 0,
  proteinTarget: 100,
  carbsCurrent: 0,
  carbsTarget: 200,
  fatCurrent: 0,
  fatTarget: 60,
  fiberCurrent: 0,
  fiberTarget: 30,
  sugarG: 0,
  sodiumMg: 0,
  waterCurrentMl: 0,
  waterTargetMl: 2000,
  formatWaterLine: () => "",
  onAddWaterMl: () => {},
};

describe("TodayDashboardMacroRings — v3 macro dials", () => {
  it("renders three macro dials", () => {
    const { container } = render(
      <TodayDashboardMacroRings
        proteinCurrent={0}
        proteinTarget={100}
        carbsCurrent={0}
        carbsTarget={200}
        fatCurrent={0}
        fatTarget={60}
        fiberCurrent={0}
        fiberTarget={30}
      />,
    );
    expect(container.querySelectorAll("svg").length).toBe(3);
  });

  it("a 60%-filled macro dial lights ~60% across DISTINCT rotations", () => {
    const { container } = render(
      <TodayDashboardMacroRings
        proteinCurrent={60}
        proteinTarget={100}
        carbsCurrent={0}
        carbsTarget={200}
        fatCurrent={0}
        fatTarget={60}
        fiberCurrent={0}
        fiberTarget={30}
      />,
    );
    const t = litTransforms(container);
    expect(t.length).toBeGreaterThan(18);
    expect(new Set(t).size).toBeGreaterThan(18);
  });
});

describe("TodayMacroSection switcher", () => {
  it("renders the rings variant when macroDisplayStyle='rings'", () => {
    const { container } = render(
      <TodayMacroSection macroDisplayStyle="rings" {...BASE_PROPS} />,
    );
    expect(
      container.querySelector('[data-testid="today-macro-rings"]'),
    ).not.toBeNull();
  });
});

describe("net-carbs lens — Tiles/Bars/Rings agreement (ENG-1508)", () => {
  // Day with fibre: gross carbs 150/200, fibre 10/30 → net 140/170.
  // Mirrored by the mobile fixture in
  // apps/mobile/tests/unit/macroRingsLayout.test.tsx.
  const LENS_PROPS = {
    ...BASE_PROPS,
    carbsCurrent: 150,
    carbsTarget: 200,
    fiberCurrent: 10,
    fiberTarget: 30,
    netCarbsLensEnabled: true,
  };

  it("rings render the same net-carbs label/value/target as the tiles math", () => {
    const tile = buildMacroTile("carbs", LENS_PROPS);
    expect(tile?.label).toBe("Net carbs");
    expect(tile?.valueText).toBe("140");
    expect(tile?.targetText).toBe("/ 170 g");

    const rings = render(
      <TodayMacroSection macroDisplayStyle="rings" {...LENS_PROPS} />,
    );
    expect(rings.getByText("Net carbs")).toBeTruthy();
    expect(rings.getByText("of 170g")).toBeTruthy();
    expect(rings.queryByText("of 200g")).toBeNull();
    // Reduced-motion mock resolves the count-up synchronously → net 140.
    expect(rings.getByText(/140/)).toBeTruthy();
  });

  it("bars agree on the same fixture", () => {
    const bars = render(
      <TodayMacroSection macroDisplayStyle="bars" {...LENS_PROPS} />,
    );
    expect(bars.getByText("Net carbs")).toBeTruthy();
    expect(bars.container.textContent).toContain("140 / 170 g");
  });

  it("rings refuse the Net carbs label when no fibre target exists", () => {
    const rings = render(
      <TodayMacroSection
        macroDisplayStyle="rings"
        {...LENS_PROPS}
        fiberCurrent={0}
        fiberTarget={0}
      />,
    );
    expect(rings.queryByText("Net carbs")).toBeNull();
    expect(rings.getByText("Carbs")).toBeTruthy();
    expect(rings.getByText("of 200g")).toBeTruthy();
  });
});
