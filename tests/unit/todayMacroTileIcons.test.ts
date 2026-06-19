/**
 * ENG-986 — the macro/extra tiles on Today must consume the shared icon SSOT,
 * and Water must keep its own Droplet glyph (NOT MACRO_ICONS.fat). This is the
 * behavioural coverage the SSOT mapping tests (macroIcons.test.ts) don't give:
 * it proves the *consumers* are wired, including the previously-uncovered
 * sugar/sodium/water tiles.
 */
import { describe, expect, it } from "vitest";
import { Candy, Droplet, Gauge } from "lucide-react";
import { MACRO_ICONS } from "../../src/lib/macroIconsLucide";
import {
  buildMacroTile,
  type TodayDashboardMacroTilesProps,
} from "../../src/app/components/suppr/today-dashboard-macro-tiles";

const props: TodayDashboardMacroTilesProps = {
  trackedMacros: ["protein", "carbs", "fat", "fiber", "sugar", "sodium", "water"],
  proteinCurrent: 50,
  proteinTarget: 120,
  carbsCurrent: 100,
  carbsTarget: 200,
  fatCurrent: 30,
  fatTarget: 60,
  fiberCurrent: 10,
  fiberTarget: 30,
  sugarG: 20,
  sodiumMg: 1000,
  waterCurrentMl: 500,
  waterTargetMl: 2000,
  formatWaterLine: (ml: number) => `${ml} ml`,
  onAddWaterMl: () => {},
};

describe("Today macro tile icons (ENG-986)", () => {
  it("binds the four macro tiles to the shared SSOT glyphs", () => {
    expect(buildMacroTile("protein", props)?.Icon).toBe(MACRO_ICONS.protein);
    expect(buildMacroTile("carbs", props)?.Icon).toBe(MACRO_ICONS.carbs);
    expect(buildMacroTile("fat", props)?.Icon).toBe(MACRO_ICONS.fat);
    expect(buildMacroTile("fiber", props)?.Icon).toBe(MACRO_ICONS.fiber);
  });

  it("keeps Water on its own Droplet glyph, decoupled from the fat key", () => {
    const water = buildMacroTile("water", props);
    expect(water?.Icon).toBe(Droplet);
    // Today they resolve to the same component; the guard is that Water reads
    // a standalone Droplet, so a future change to the fat glyph can't silently
    // re-skin Water. Mirrors mobile, which also uses a direct Droplet.
  });

  it("covers the reference tiles (sugar/sodium) glyphs", () => {
    expect(buildMacroTile("sugar", props)?.Icon).toBe(Candy);
    expect(buildMacroTile("sodium", props)?.Icon).toBe(Gauge);
  });
});
