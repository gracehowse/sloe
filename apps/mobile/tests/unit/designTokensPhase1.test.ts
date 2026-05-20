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

    it("source-usda hex values match the production design spec §1.4 table", () => {
      // Light = #62b35a (leaf green); dark = #82d878.
      expect(Colors.light.sourceUsda.toLowerCase()).toBe("#62b35a");
      expect(Colors.dark.sourceUsda.toLowerCase()).toBe("#82d878");
    });

    it("source-ai hex values match magenta", () => {
      expect(Colors.light.sourceAi.toLowerCase()).toBe("#e04888");
      expect(Colors.dark.sourceAi.toLowerCase()).toBe("#ff7eb3");
    });

    it("over-budget-fg uses amber, NOT red (per project memory)", () => {
      expect(Colors.light.overBudgetFg.toLowerCase()).toBe("#e0a838");
      expect(Colors.dark.overBudgetFg.toLowerCase()).toBe("#f0c058");
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

    it("card uses 0.06 opacity / 6 radius / +1 height (per spec §1.3)", () => {
      expect(Elevation.card.shadowOpacity).toBe(0.06);
      expect(Elevation.card.shadowRadius).toBe(6);
      expect(Elevation.card.shadowOffset).toEqual({ width: 0, height: 1 });
      expect(Elevation.card.elevation).toBe(1);
    });

    it("sheet uses negative height (-8) for top-edge shadow", () => {
      expect(Elevation.sheet.shadowOffset).toEqual({ width: 0, height: -8 });
    });

    it("floatPrimary uses primary tint (#4c6ce0) for FAB", () => {
      expect(Elevation.floatPrimary.shadowColor.toLowerCase()).toBe("#4c6ce0");
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
