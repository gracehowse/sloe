/**
 * Production design spec — 2026-04-27 — Phase 1 mobile token coverage.
 *
 * Pins the canonical mobile theme tokens added in Phase 1:
 *   - Colors.{light,dark} adds (sourceUsda / sourceOff / sourceFatsecret /
 *     sourceManual / sourceAi / confidenceNeutral / northStarBgFrom /
 *     northStarBgTo / northStarBorder / overBudgetFg / overBudgetSoft /
 *     destructiveForeground / primaryForeground)
 *   - Type ladder (display / title / headline / body / bodyMuted / label /
 *     caption / ringValue / ringValueLg)
 *   - Elevation (card / sheet / float / floatPrimary)
 *   - IconSize (xs=10 / sm=12 / md=14 / base=16 / lg=18 / xl=20 / hero=24)
 *   - Spring (softSheet / snapSegment)
 *
 * If any of these export shapes drifts, tests break.
 */
import { describe, expect, it } from "vitest";
import {
  Colors,
  Elevation,
  IconSize,
  Spring,
  Type,
} from "../../constants/theme";

describe("mobile theme — Phase 1 production design spec coverage", () => {
  describe("Colors light/dark adds", () => {
    const REQUIRED_KEYS = [
      "sourceUsda",
      "sourceOff",
      "sourceFatsecret",
      "sourceManual",
      "sourceAi",
      "confidenceNeutral",
      "northStarBgFrom",
      "northStarBgTo",
      "northStarBorder",
      "overBudgetFg",
      "overBudgetSoft",
      "destructiveForeground",
      "primaryForeground",
    ] as const;

    for (const key of REQUIRED_KEYS) {
      it(`Colors.light has '${key}'`, () => {
        expect(Colors.light).toHaveProperty(key);
        expect(typeof Colors.light[key as keyof typeof Colors.light]).toBe(
          "string",
        );
      });
      it(`Colors.dark has '${key}'`, () => {
        expect(Colors.dark).toHaveProperty(key);
        expect(typeof Colors.dark[key as keyof typeof Colors.dark]).toBe(
          "string",
        );
      });
    }

    it("source-usda maps to Green slot (8-slot palette)", () => {
      // 2026-05-22 evening: 8-slot palette. Was #62b35a → now #56A775.
      expect(Colors.light.sourceUsda.toLowerCase()).toBe("#56a775");
      expect(Colors.dark.sourceUsda.toLowerCase()).toBe("#7abe93");
    });

    it("source-ai maps to Magenta slot", () => {
      // Was #e04888 → now #DF5EBC.
      expect(Colors.light.sourceAi.toLowerCase()).toBe("#df5ebc");
      expect(Colors.dark.sourceAi.toLowerCase()).toBe("#e689cb");
    });

    it("over-budget-fg maps to Orange slot (calmer than ring's red)", () => {
      // The ring uses Accent.destructive (Red) for the over arc; the
      // overBudgetFg text token stays Orange (calmer for inline copy
      // like "over by 50 kcal"). Was #e0a838 → now #F78A32.
      expect(Colors.light.overBudgetFg.toLowerCase()).toBe("#f78a32");
      expect(Colors.dark.overBudgetFg.toLowerCase()).toBe("#faa45f");
    });
  });

  describe("Type ladder", () => {
    const REQUIRED = [
      "display",
      "title",
      "headline",
      "body",
      "bodyMuted",
      "label",
      "caption",
      "macroValue",
      "ringValue",
      "ringValueLg",
    ] as const;

    for (const key of REQUIRED) {
      it(`Type.${key} is a complete TextStyle object`, () => {
        const entry = Type[key];
        expect(entry).toBeDefined();
        expect(typeof entry.fontSize).toBe("number");
        expect(typeof entry.lineHeight).toBe("number");
        expect(typeof entry.fontWeight).toBe("string");
      });
    }

    it("Type.title is 24/28/700 (-0.02em ≈ -0.5 letterSpacing)", () => {
      expect(Type.title.fontSize).toBe(24);
      expect(Type.title.lineHeight).toBe(28);
      expect(Type.title.fontWeight).toBe("700");
      expect(Type.title.letterSpacing).toBe(-0.5);
    });

    it("Type.macroValue matches Today macro tiles (20/24/700/-0.35)", () => {
      expect(Type.macroValue.fontSize).toBe(20);
      expect(Type.macroValue.lineHeight).toBe(24);
      expect(Type.macroValue.fontWeight).toBe("700");
      expect(Type.macroValue.letterSpacing).toBe(-0.35);
    });

    it("Type.label is uppercase + 0.08em letterSpacing (= 0.88)", () => {
      expect(Type.label.textTransform).toBe("uppercase");
      expect(Type.label.letterSpacing).toBe(0.88);
    });

    it("Type.body is 14/20/500 0", () => {
      expect(Type.body.fontSize).toBe(14);
      expect(Type.body.lineHeight).toBe(20);
      expect(Type.body.fontWeight).toBe("500");
    });
  });

  describe("Elevation", () => {
    it("exports card / sheet / float / floatPrimary", () => {
      expect(Elevation.card).toBeDefined();
      expect(Elevation.sheet).toBeDefined();
      expect(Elevation.float).toBeDefined();
      expect(Elevation.floatPrimary).toBeDefined();
    });

    it("card uses 0.10 opacity / 12 radius / +3 height (premium depth)", () => {
      expect(Elevation.card.shadowOpacity).toBe(0.05);
      expect(Elevation.card.shadowRadius).toBe(8);
      expect(Elevation.card.shadowOffset).toEqual({ width: 0, height: 2 });
      expect(Elevation.card.elevation).toBe(1);
    });

    it("sheet uses negative height (-8) for top-edge shadow", () => {
      expect(Elevation.sheet.shadowOffset).toEqual({ width: 0, height: -8 });
    });

    it("floatPrimary shadow is brand-blue (tracks Accent.primary)", () => {
      // 8-slot palette: Accent.primary is now #588CE4 (was warm
      // periwinkle #5b6ee8 → reverted to canonical Blue 2026-05-22).
      expect(Elevation.floatPrimary.shadowColor.toLowerCase()).toBe("#588ce4");
    });
  });

  describe("IconSize", () => {
    it("exports the canonical 7-step ladder", () => {
      expect(IconSize.xs).toBe(10);
      expect(IconSize.sm).toBe(12);
      expect(IconSize.md).toBe(14);
      expect(IconSize.base).toBe(16);
      expect(IconSize.lg).toBe(18);
      expect(IconSize.xl).toBe(20);
      expect(IconSize.hero).toBe(24);
    });
  });

  describe("Spring (Reanimated configs)", () => {
    it("softSheet matches spec damping=18 stiffness=220 mass=0.9", () => {
      expect(Spring.softSheet.damping).toBe(18);
      expect(Spring.softSheet.stiffness).toBe(220);
      expect(Spring.softSheet.mass).toBe(0.9);
    });

    it("snapSegment matches spec damping=22 stiffness=320", () => {
      expect(Spring.snapSegment.damping).toBe(22);
      expect(Spring.snapSegment.stiffness).toBe(320);
    });
  });
});
