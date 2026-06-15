import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

import { Accent, AccentWinGradient, FontFamily, Type } from "../../constants/theme";

import * as themeModule from "../../constants/theme";

/**
 * SLOE Phase 0 (`docs/ux/redesign/phase-0-token-foundation-dossier.md`, dossier
 * D-3). The win / celebration role is a DISTINCT landmark-only hue, intentionally
 * outside the 6-hue action palette. It must never collapse onto the commit-CTA
 * colour (`primary` = aubergine) or the state/data colour (`success` = sage) —
 * that three-role split is the whole point of the token. Sloe sets the persistent
 * win to DAMSON `#6A4B7A` and the celebration fill to the aubergine brand gradient
 * (plum → aubergine-lift → elevated-lift), retiring the prior blue→purple→magenta
 * brand spectrum, the older interim amber `#F2A93B` / gold, and the brief clay
 * middle stop that shipped before the 2026-06-08 aubergine accent decision.
 * Damson is collision-free with the carbs/sodium/warning hues. Mirrors web
 * `--accent-win` / `--accent-win-gradient` in `src/styles/theme.css`.
 */
describe("Accent win token", () => {
  it("win is its own hue — distinct from success (state/data colour)", () => {
    expect(Accent.win).not.toBe(Accent.success);
  });

  it("win is its own hue — distinct from primary (commit-CTA colour)", () => {
    expect(Accent.win).not.toBe(Accent.primary);
  });

  it("win is its own hue — distinct from the carbs/sodium/warning family", () => {
    // The win hue must not be confused with carbs (clay), sodium, or the
    // over-budget/warning amber. Damson keeps it in its own lane.
    expect(Accent.win).not.toBe(Accent.carbs);
    expect(Accent.win).not.toBe(Accent.warning);
    expect(Accent.win).not.toBe(Accent.orange);
  });

  it("win is the Sloe damson and winSoft is its alpha form", () => {
    expect(Accent.win).toBe("#6A4B7A");
    expect(Accent.winSoft).toBe("rgba(106, 75, 122, 0.12)");
  });

  it("the retired interim amber / brand-spectrum purple are gone", () => {
    expect(Accent.win).not.toBe("#F2A93B");
    expect(Accent.win).not.toBe("#9679D9");
    expect(Accent.winSoft).not.toBe("rgba(242, 169, 59, 0.12)");
    expect(Accent.winSoft).not.toBe("rgba(150, 121, 217, 0.12)");
  });
});

/**
 * The celebration FILL is a 3-stop SLOE BRAND gradient. The stops + offsets must
 * match web `--accent-win-gradient`
 * (`linear-gradient(120deg, #3B2A4D 0%, #5B3B6E 50%, #7E5C92 100%)`) — plum
 * → aubergine (primaryLight) → lift — so the goal-hit moment looks identical
 * across platforms. Updated 2026-06-08 per
 * `docs/decisions/2026-06-08-aubergine-accent-system.md`: the brief clay middle
 * stop was replaced by the aubergine `primaryLight` when aubergine became the
 * single functional accent.
 */
describe("AccentWinGradient (win-moment fill)", () => {
  it("has the three Sloe brand-gradient stops in paint order", () => {
    // plum (primary) → aubergine lift (primaryLight) → elevated lift (#7E5C92)
    // Mirrors web --accent-win-gradient (#3B2A4D → #5B3B6E → #7E5C92).
    expect(AccentWinGradient.stops).toEqual([
      Accent.primary,
      Accent.primaryLight,
      "#7E5C92",
    ]);
  });

  it("the middle stop is the Sloe primaryLight (aubergine lift)", () => {
    expect(AccentWinGradient.stops[1]).toBe(Accent.primaryLight);
  });

  it("offsets mirror the web 0% / 50% / 100% stop positions", () => {
    expect(AccentWinGradient.offsets).toEqual([0, 0.5, 1]);
  });
});

/**
 * Frost secondary-colour exploration — RETIRED (ENG-997, 2026-06-08).
 *
 * The brand-manager decision made Aubergine `#5B3B6E` the UNCONDITIONAL
 * functional accent (superseding the brief clay-as-accent interim — see
 * `docs/decisions/2026-06-08-aubergine-accent-system.md`), so the `AccentFrost`
 * / `AccentWinGradientFrost` variants were deleted from `constants/theme.ts` and
 * the flag wiring removed from `context/theme.tsx`. These are the RETIREMENT
 * guards — they fail if the dead variants creep back. Mirrors the web
 * `frostFlagTokens.test.ts`.
 */
describe("Frost variants retired", () => {
  it("AccentFrost is no longer exported", () => {
    expect("AccentFrost" in themeModule).toBe(false);
  });

  it("AccentWinGradientFrost is no longer exported", () => {
    expect("AccentWinGradientFrost" in themeModule).toBe(false);
  });

  it("brand_frost_secondary wiring is gone from context/theme.tsx", () => {
    const ctx = readFileSync(
      resolve(__dirname, "../../context/theme.tsx"),
      "utf8",
    );
    expect(ctx).not.toContain("AccentFrost");
    expect(ctx).not.toContain("FROST_FLAG");
    // The retirement note may name the flag, but there must be no live
    // `isFeatureEnabled("brand_frost_secondary")` read.
    expect(ctx).not.toMatch(/isFeatureEnabled\(\s*["']brand_frost_secondary["']/);
  });
});

/**
 * Aubergine is the unconditional functional accent (2026-06-08). `Accent.primary`
 * is the deep-plum base (`#3B2A4D`); `Accent.primaryLight` is the aubergine-lift
 * (`#5B3B6E`) used for CTAs and the gradient middle stop. Clay (`#C8794E`)
 * survives only as `Accent.carbs` / `MacroColors.carbs`. See
 * `docs/decisions/2026-06-08-aubergine-accent-system.md`.
 */
describe("Aubergine is the unconditional functional accent", () => {
  it("Accent.primary is the deep-plum aubergine base, not clay", () => {
    // The aubergine system: deep plum (#3B2A4D) is the base; primarySolid is
    // the same hue for text/icon/outline usage. Clay (#C8794E) is carbs-only.
    expect(Accent.primary).toBe(Accent.primarySolid);
    expect(Accent.primary).not.toBe(Accent.carbs);
  });

  it("the win-moment gradient middle stop is aubergine primaryLight, not clay", () => {
    // Middle stop is Accent.primaryLight (#5B3B6E), not clay (#C8794E).
    expect(AccentWinGradient.stops[1]).toBe(Accent.primaryLight);
    expect(AccentWinGradient.stops[1]).not.toBe(Accent.carbs);
  });
});

/**
 * `Type.heroValue` — the serif sibling of `macroValue` (ENG-997, 2026-06-08).
 * SLOE Phase 0 wants the BIG hero numerals (targets / profile / weight + the
 * Today macro-tile numeral) in Newsreader serif; this token lets a big-numeral
 * surface adopt serif without forcing serif on the small inline macro callouts
 * that keep `macroValue` (saved-meal portion / ingredient sheets). It's the
 * same 20/24 box + letter-spacing as `macroValue` — only the family differs —
 * so it's a drop-in swap. (Agent C adopts it on the big-numeral screens.)
 */
describe("Type.heroValue (serif big-numeral token)", () => {
  it("renders in Newsreader serif (not the sans macroValue family)", () => {
    expect(Type.heroValue.fontFamily).toBe(FontFamily.serifMedium);
    expect(Type.heroValue.fontFamily).not.toBe(Type.macroValue.fontFamily);
  });

  it("matches the macroValue box so it's a drop-in swap (20/24/-0.35)", () => {
    expect(Type.heroValue.fontSize).toBe(Type.macroValue.fontSize);
    expect(Type.heroValue.lineHeight).toBe(Type.macroValue.lineHeight);
    expect(Type.heroValue.letterSpacing).toBe(Type.macroValue.letterSpacing);
  });

  it("macroValue itself STAYS sans (small inline callouts must not go serif)", () => {
    expect(Type.macroValue.fontFamily).toBe(FontFamily.sansBold);
  });
});

describe("Type.statValue (ENG-1099 M4 hero stat row)", () => {
  it("uses serif 18/22 for Goal/Eaten/Bonus under the ring", () => {
    expect(Type.statValue.fontFamily).toBe(FontFamily.serifRegular);
    expect(Type.statValue.fontSize).toBe(18);
    expect(Type.statValue.lineHeight).toBe(22);
  });
});
