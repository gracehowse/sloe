/**
 * ENG-986 — pin macro glyph mapping to Figma `654:101`.
 */
import { describe, expect, it } from "vitest";
import {
  Dumbbell,
  Droplet,
  Flame,
  Sprout,
  Wheat,
} from "lucide-react";
import { FIGMA_MACRO_ICON_GLYPHS, MACRO_ICON_KEYS } from "../../src/lib/macroIcons";
import { MACRO_ICONS } from "../../src/lib/macroIconsLucide";

describe("macroIcons (ENG-986)", () => {
  it("maps each macro to the Figma-verified lucide glyph name", () => {
    expect(FIGMA_MACRO_ICON_GLYPHS).toEqual({
      calories: "Flame",
      protein: "Dumbbell",
      carbs: "Wheat",
      fat: "Droplet",
      fiber: "Sprout",
    });
  });

  it("web MACRO_ICONS resolves to the expected lucide components", () => {
    expect(MACRO_ICONS.calories).toBe(Flame);
    expect(MACRO_ICONS.protein).toBe(Dumbbell);
    expect(MACRO_ICONS.carbs).toBe(Wheat);
    expect(MACRO_ICONS.fat).toBe(Droplet);
    expect(MACRO_ICONS.fiber).toBe(Sprout);
    expect(MACRO_ICON_KEYS).toHaveLength(5);
  });
});
