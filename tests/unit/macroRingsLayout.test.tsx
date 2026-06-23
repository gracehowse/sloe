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
