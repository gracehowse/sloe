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

    it("source-usda maps to Sloe sage", () => {
      // Sloe Phase 0 (dossier D-4): USDA → sage.
      expect(Colors.light.sourceUsda.toLowerCase()).toBe("#5e7c5a");
      expect(Colors.dark.sourceUsda.toLowerCase()).toBe("#83a57e");
    });

    it("source-ai maps to Sloe damson", () => {
      // Sloe Phase 0 (dossier D-4): AI → damson; dark lifts to #9A7BAA
      // (the OLED-readable damson-accent, mirrors web dark --source-ai).
      expect(Colors.light.sourceAi.toLowerCase()).toBe("#6a4b7a");
      expect(Colors.dark.sourceAi.toLowerCase()).toBe("#9a7baa");
    });

    it("over-budget-fg maps to Sloe destructive red (D-2)", () => {
      // Sloe Phase 0 (dossier D-2): fat now owns amber, so over-budget moves
      // to red — the ring overage AND the inline "over by N" copy share the
      // destructive hue. Was orange (#F78A32) → now #C0533F.
      expect(Colors.light.overBudgetFg.toLowerCase()).toBe("#c0533f");
      expect(Colors.dark.overBudgetFg.toLowerCase()).toBe("#dc6b55");
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

    it("Type.title is 24/28 serif-regular (SLOE Newsreader title)", () => {
      // SLOE Phase 0 (2026-06-03): title moved to Newsreader (serif) at the
      // regular 400 weight with -0.3 tracking — the approved Figma headline
      // grammar. (This assertion was stale at 700/-0.5 from the pre-SLOE
      // sans ladder; aligned 2026-06-04 alongside the Today measured-spec pass
      // so the file's token pins match the shipped theme. Size/line-height are
      // unchanged at 24/28.)
      expect(Type.title.fontSize).toBe(24);
      expect(Type.title.lineHeight).toBe(28);
      expect(Type.title.fontWeight).toBe("400");
      expect(Type.title.letterSpacing).toBe(-0.3);
    });

    it("Type.macroValue matches Today macro tiles (20/24/700/-0.35)", () => {
      expect(Type.macroValue.fontSize).toBe(20);
      expect(Type.macroValue.lineHeight).toBe(24);
      expect(Type.macroValue.fontWeight).toBe("700");
      expect(Type.macroValue.letterSpacing).toBe(-0.35);
    });

    it("Type.ringValue is the 48px Today ring centre numeral (2026-06-04 spec)", () => {
      // Bumped 36→48 to match the Stitch `today.html` centre value
      // (`text-5xl` ≈ 48px). The two collateral consumers
      // (TodayActivityBonusCard net headline + WinMomentPlayer pct) pin 36
      // at their call sites, so this token size lands only on the ring.
      expect(Type.ringValue.fontSize).toBe(48);
      expect(Type.ringValue.lineHeight).toBe(48);
      // serif family + tight tracking preserved through the bump.
      expect(Type.ringValue.letterSpacing).toBe(-0.5);
    });

    it("Type.ringValueLg is untouched at 56 (the larger hero numeral)", () => {
      expect(Type.ringValueLg.fontSize).toBe(56);
      expect(Type.ringValueLg.lineHeight).toBe(56);
    });

    it("Type.coach is the 17px plum editorial coach line (2026-06-04 spec)", () => {
      // Bumped 14→17 to match the Stitch `today.html` coach line
      // (`text-[17px] text-plum/90` italic). lineHeight ~23. Sole consumer:
      // TodayDeficitInsight (which sets the plum colour).
      expect(Type.coach.fontSize).toBe(17);
      expect(Type.coach.lineHeight).toBe(23);
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

    it("card is flat (hairline-only hierarchy, 2026-05-22 lock)", () => {
      expect(Elevation.card.shadowOpacity).toBe(0);
      expect(Elevation.card.shadowRadius).toBe(0);
      expect(Elevation.card.shadowOffset).toEqual({ width: 0, height: 0 });
      expect(Elevation.card.elevation).toBe(0);
    });

    it("sheet uses negative height (-8) for top-edge shadow", () => {
      expect(Elevation.sheet.shadowOffset).toEqual({ width: 0, height: -8 });
    });

    it("floatPrimary shadow tracks Accent.primary (Sloe clay)", () => {
      // Sloe Phase 0: Accent.primary is clay #C8794E; the FAB glow follows it.
      expect(Elevation.floatPrimary.shadowColor.toLowerCase()).toBe("#c8794e");
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
