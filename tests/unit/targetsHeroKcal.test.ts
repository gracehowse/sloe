import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const webTargets = fs.readFileSync(
  path.resolve("src/app/components/Targets.tsx"),
  "utf-8",
);
const mobileTargets = fs.readFileSync(
  path.resolve("apps/mobile/app/targets.tsx"),
  "utf-8",
);

/**
 * ENG-63 · Targets daily-kcal hero display.
 *
 * SLOE Phase 0 (2026-06-08): the hero calorie numeral moved off the sans
 * `font-extrabold` / `fontWeight: "800"` treatment to Newsreader serif —
 * the design system reserves big numerals for serif. Web uses the
 * `.font-display` opt-in class (the canonical serif-numeral hook, also used
 * by Progress + Today display numerals); mobile reuses the `Type.ringValue`
 * token (the exact serif token the Today calorie ring uses) so the two hero
 * numbers stay byte-identical in face/size/weight. The 48px size + tabular
 * alignment parity is preserved.
 */
describe("ENG-63 · Targets daily kcal hero display", () => {
  it("web renders the hero kcal number at 48px", () => {
    expect(webTargets).toContain("text-[48px]");
  });

  it("web renders the hero kcal number in the serif (font-display)", () => {
    expect(webTargets).toContain("font-display text-[48px]");
  });

  it("web no longer uses the banned sans extrabold weight on the hero numeral", () => {
    // The hero numeral span must not carry `font-extrabold`; the serif
    // carries its own weight. (Other surfaces may still use extrabold, so
    // we scope the assertion to the hero numeral line.)
    const heroLine = webTargets
      .split("\n")
      .find((l) => l.includes("text-[48px]"));
    expect(heroLine).toBeDefined();
    expect(heroLine).not.toContain("font-extrabold");
  });

  it("web keeps tabular-nums on the hero numeral", () => {
    expect(webTargets).toContain("tabular-nums");
  });

  it("web keeps tight tracking (-0.03em) on the hero numeral", () => {
    expect(webTargets).toContain("-tracking-[0.03em]");
  });

  it("mobile renders the hero kcal number via the serif ring-value token", () => {
    // `bigNumber` spreads `Type.ringValue` (Newsreader serif, 48px) instead
    // of a literal sans 48/800 — keeps web/mobile hero parity in one token.
    expect(mobileTargets).toContain("...Type.ringValue");
  });

  it("mobile no longer uses the banned sans 800 weight on the hero numeral", () => {
    // Scope to the `bigNumber` style block: it must spread the serif
    // `Type.ringValue` token and carry no hardcoded sans weight. (Uppercase
    // 11px labels — overline / macroLabel / MAINTENANCE — keep `fontWeight:
    // "800"` legitimately; only the hero numeral must not.)
    const start = mobileTargets.indexOf("bigNumber: {");
    expect(start).toBeGreaterThan(-1);
    // Slice only the `bigNumber` block (up to its closing brace), so the
    // assertion doesn't bleed into the adjacent `kcalUnit` style.
    const block = mobileTargets.slice(
      start,
      mobileTargets.indexOf("},", start) + 2,
    );
    expect(block).toContain("...Type.ringValue");
    expect(block).not.toContain("fontWeight");
  });

  it("mobile keeps tabular-nums on the hero numeral", () => {
    expect(mobileTargets).toContain("tabular-nums");
  });

  it("mobile macro tile numerals read in Newsreader serif", () => {
    // Parity with web: the macro target values on the Targets surface use
    // the serif face (FontFamily.serifRegular) — the documented override of
    // the sans `Type.macroValue` used on the tiny Today ring tiles.
    expect(mobileTargets).toContain("fontFamily: FontFamily.serifRegular");
  });

  it("web macro tile numerals read in Newsreader serif (font-display)", () => {
    expect(webTargets).toMatch(/font-display text-\[22px\]/);
  });
});

/**
 * Targets decorative display ring — accent (clay) tint, never hardcoded
 * plum/damson.
 *
 * Brand-manager 2026-06-08: clay (#C8794E) is the functional accent; plum
 * (#3B2A4D / `--macro-calories`) and damson (#6A4B7A) are brand-identity /
 * named-data roles only and must NEVER read as "the accent". The Targets
 * card's ring is a DECORATIVE full-sweep target display (not the calorie
 * progress ring, which legitimately keeps its plum state in `daily-ring.tsx`)
 * — so it must tint from the accent token. Mobile already sources the ring
 * from `accent.primary` (clay); web must match by sourcing `--primary`.
 */
describe("Targets decorative ring tints from the clay accent (not plum)", () => {
  it("web ring gradient does NOT hardcode the plum calorie hue", () => {
    // `--macro-calories` (plum) is reserved for the actual calorie ring; the
    // decorative target-display ring must not borrow it as a pseudo-accent.
    // Scope to the targets ring gradient block.
    const gradientBlock = webTargets.slice(
      webTargets.indexOf('id="targets-ring-gradient"'),
      webTargets.indexOf("</linearGradient>") + "</linearGradient>".length,
    );
    expect(gradientBlock).not.toContain("var(--macro-calories)");
    expect(gradientBlock).not.toContain("#3B2A4D");
    expect(gradientBlock).not.toContain("#6A4B7A"); // damson — also banned as accent
  });

  it("web ring gradient sources the clay accent token", () => {
    const gradientBlock = webTargets.slice(
      webTargets.indexOf('id="targets-ring-gradient"'),
      webTargets.indexOf("</linearGradient>") + "</linearGradient>".length,
    );
    expect(gradientBlock).toContain("var(--primary)");
  });

  it("mobile ring gradient sources the (clay) accent — not a hardcoded damson/plum", () => {
    // The SVG gradient stops read `accent.primaryLight` → `accent.primary`,
    // which resolve to clay while the Frost flag is off; never a literal
    // plum/damson hex on the decorative ring.
    expect(mobileTargets).toContain("stopColor={accent.primaryLight}");
    expect(mobileTargets).toContain("stopColor={accent.primary}");
    // Guard: no hardcoded plum/damson hexes anywhere in the screen.
    expect(mobileTargets).not.toContain("#3B2A4D");
    expect(mobileTargets).not.toContain("#6A4B7A");
  });
});
