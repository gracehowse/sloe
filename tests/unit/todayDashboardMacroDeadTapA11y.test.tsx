/**
 * ENG-848 — macro dead-tap a11y fix (web).
 *
 * PR #471 wired the per-macro detail panel behind `web_macro_detail_panel`.
 * When the host passes `onPressMacro`, the macro tiles + bars rendered EVERY
 * macro — including reference-only sugar/sodium/water — as a real interactive
 * `<button>` with role=button, an "Open … breakdown" aria-label, and full
 * hover/focus/active affordance. But the host's `openMacroDetail` handler only
 * resolves protein/carbs/fat/fiber (the panel has no breakdown for the others),
 * so sugar/sodium/water were DEAD TAPS: a screen reader announced an actionable
 * control that did nothing.
 *
 * The fix makes the interactive affordance conditional per-macro via the shared
 * `isMacroDetailSupported` source of truth (exported from MacroDetailPanel and
 * reused by the tiles, the bars, AND the handler guard). These tests render the
 * real components (NOT a source grep) and assert that, with `onPressMacro`
 * wired:
 *   - protein/carbs/fat/fiber DO render as buttons with the breakdown label
 *   - sugar/sodium/water do NOT render as buttons (plain static element,
 *     no role=button, no "Open … breakdown" aria-label)
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// Force the per-tile bar+caption (legacy) path on for the tiles component so the
// tile DOM is fully exercised — matches todayDashboardMacroTilesCaption.test.tsx.
// (Unrelated to the affordance under test, which is flag-independent.)
vi.mock("../../src/lib/analytics/track", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/analytics/track")>()),
  isFeatureEnabled: (flag: string) =>
    flag === "today_tracker_tier_v1" ? false : true,
}));

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

const SUPPORTED = ["protein", "carbs", "fat", "fiber"];
const UNSUPPORTED = ["sugar", "sodium", "water"];

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

describe("macro-detail supported-key source of truth (ENG-848)", () => {
  it("enumerates exactly protein/carbs/fat/fiber", () => {
    expect([...MACRO_DETAIL_SUPPORTED_KEYS]).toEqual(SUPPORTED);
  });

  it("treats reference-only nutrients as unsupported", () => {
    for (const k of SUPPORTED) expect(isMacroDetailSupported(k)).toBe(true);
    for (const k of UNSUPPORTED) expect(isMacroDetailSupported(k)).toBe(false);
    // `calories` is a valid MacroKey for the panel but is not a tile/bar.
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
    expect(queryByRole("button", { name: "Open Sugar breakdown" })).toBeNull();
    expect(queryByRole("button", { name: "Open Sodium breakdown" })).toBeNull();
    expect(queryByRole("button", { name: "Open Water breakdown" })).toBeNull();
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
