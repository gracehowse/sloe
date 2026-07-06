/**
 * ENG-848 — macro dead-tap a11y fix (web).
 * ENG-1213 — web↔mobile water-breakdown parity (water is now interactive).
 *
 * PR #471 wired the per-macro detail panel behind `web_macro_detail_panel`.
 * When the host passes `onPressMacro`, the macro tiles + bars rendered EVERY
 * macro — including reference-only sugar/sodium/water — as a real interactive
 * `<button>`. But the host's `openMacroDetail` handler only resolved
 * protein/carbs/fat/fiber, so sugar/sodium/water were DEAD TAPS.
 *
 * ENG-1213 levelled web UP to mobile: web now has a real water breakdown
 * (per-meal, sourced from `nutrition_entries.water_ml`), so `water` joins the
 * supported set and is interactive again. sugar/sodium stay reference-only and
 * non-interactive on both platforms. The interactive set is now exactly
 * {protein, carbs, fat, fiber, water} on web AND mobile.
 *
 * These tests render the real components (NOT a source grep) and assert that,
 * with `onPressMacro` wired:
 *   - protein/carbs/fat/fiber/water DO render as buttons with the breakdown label
 *   - sugar/sodium do NOT render as buttons (plain static element,
 *     no role=button, no "Open … breakdown" aria-label)
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { TodayDashboardMacroTiles } from "../../src/app/components/suppr/today-dashboard-macro-tiles";
import { TodayDashboardMacroBars } from "../../src/app/components/suppr/today-dashboard-macro-bars";
import {
  isMacroDetailSupported,
  MACRO_DETAIL_SUPPORTED_KEYS,
} from "../../src/app/components/MacroDetailPanel";

const ALL_MACROS = [
  "protein",
  "carbs",
  "fat",
  "fiber",
  "sugar",
  "sodium",
  "water",
];

const SUPPORTED = ["protein", "carbs", "fat", "fiber", "water"];
const UNSUPPORTED = ["sugar", "sodium"];

const tilesProps = {
  trackedMacros: ALL_MACROS,
  proteinCurrent: 96,
  proteinTarget: 140,
  carbsCurrent: 168,
  carbsTarget: 200,
  fatCurrent: 48,
  fatTarget: 68,
  fiberCurrent: 22,
  fiberTarget: 30,
  sugarG: 18,
  sodiumMg: 1100,
  waterCurrentMl: 1000,
  waterTargetMl: 2500,
  formatWaterLine: (ml: number) => `${(ml / 1000).toFixed(1)} L`,
  onAddWaterMl: () => {},
};

const barsProps = {
  trackedMacros: ALL_MACROS,
  proteinCurrent: 96,
  proteinTarget: 140,
  carbsCurrent: 168,
  carbsTarget: 200,
  fatCurrent: 48,
  fatTarget: 68,
  fiberCurrent: 22,
  fiberTarget: 30,
  sugarG: 18,
  sodiumMg: 1100,
  waterCurrentMl: 1000,
  waterTargetMl: 2500,
};

describe("macro-detail supported-key source of truth (ENG-848 / ENG-1213)", () => {
  it("enumerates exactly protein/carbs/fat/fiber/water (web↔mobile parity)", () => {
    expect([...MACRO_DETAIL_SUPPORTED_KEYS]).toEqual(SUPPORTED);
  });

  it("treats reference-only sugar/sodium as unsupported; water IS supported", () => {
    for (const k of SUPPORTED) expect(isMacroDetailSupported(k)).toBe(true);
    for (const k of UNSUPPORTED) expect(isMacroDetailSupported(k)).toBe(false);
    // water joined the interactive set (ENG-1213 — real per-meal breakdown).
    expect(isMacroDetailSupported("water")).toBe(true);
    // `calories` is a valid MacroKey the panel can render (ring deep-link) but
    // is NOT a tile/bar — there is no calories tile (calories is the ring).
    expect(isMacroDetailSupported("calories")).toBe(false);
  });
});

describe("TodayDashboardMacroTiles — dead-tap a11y (ENG-848)", () => {
  it("renders protein/carbs/fat/fiber as interactive buttons when onPressMacro is wired", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles {...tilesProps} onPressMacro={() => undefined} />,
    );
    for (const key of SUPPORTED) {
      const el = getByTestId(`today-macro-tile-${key}`);
      expect(el.tagName).toBe("BUTTON");
      expect(el.getAttribute("aria-label")).toMatch(/^Open .+ breakdown$/);
    }
  });

  it("renders sugar/sodium/water as plain, non-interactive elements (no dead taps)", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles {...tilesProps} onPressMacro={() => undefined} />,
    );
    for (const key of UNSUPPORTED) {
      const el = getByTestId(`today-macro-tile-${key}`);
      expect(el.tagName).not.toBe("BUTTON");
      expect(el.getAttribute("role")).not.toBe("button");
      expect(el.getAttribute("aria-label")).toBeNull();
    }
  });

  it("exposes exactly the supported macros as buttons via the accessibility tree", () => {
    const { queryByRole } = render(
      <TodayDashboardMacroTiles {...tilesProps} onPressMacro={() => undefined} />,
    );
    expect(queryByRole("button", { name: "Open Protein breakdown" })).toBeTruthy();
    // ENG-1213: water is interactive again now web has a real water breakdown.
    expect(queryByRole("button", { name: "Open Water breakdown" })).toBeTruthy();
    expect(queryByRole("button", { name: "Open Sugar breakdown" })).toBeNull();
    expect(queryByRole("button", { name: "Open Sodium breakdown" })).toBeNull();
  });
});

describe("TodayDashboardMacroBars — dead-tap a11y (ENG-848)", () => {
  it("renders protein/carbs/fat/fiber as interactive buttons when onPressMacro is wired", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroBars {...barsProps} onPressMacro={() => undefined} />,
    );
    for (const key of SUPPORTED) {
      const el = getByTestId(`today-macro-bar-${key}`);
      expect(el.tagName).toBe("BUTTON");
      expect(el.getAttribute("aria-label")).toBeTruthy();
    }
  });

  it("renders sugar/sodium/water as plain, non-interactive elements (no dead taps)", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroBars {...barsProps} onPressMacro={() => undefined} />,
    );
    for (const key of UNSUPPORTED) {
      const el = getByTestId(`today-macro-bar-${key}`);
      expect(el.tagName).not.toBe("BUTTON");
      expect(el.getAttribute("role")).not.toBe("button");
      expect(el.getAttribute("aria-label")).toBeNull();
    }
  });
});
