import { describe, it, expect } from "vitest";

import { Accent, AccentWinGradient } from "../../constants/theme";

/**
 * SLOE Phase 0 (`docs/ux/redesign/phase-0-token-foundation-dossier.md`, dossier
 * D-3). The win / celebration role is a DISTINCT landmark-only hue, intentionally
 * outside the 6-hue action palette. It must never collapse onto the commit-CTA
 * colour (`primary` = clay) or the state/data colour (`success` = sage) — that
 * three-role split is the whole point of the token. Sloe sets the persistent win
 * to DAMSON `#6A4B7A` and the celebration fill to the warm Sloe brand gradient
 * (plum → clay → amber), retiring the prior blue→purple→magenta brand spectrum
 * (and the older interim amber `#F2A93B` / gold). Damson is collision-free with
 * the carbs/sodium/warning hues. Mirrors web `--accent-win` /
 * `--accent-win-gradient` in `src/styles/theme.css`.
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
 * (`linear-gradient(120deg, #3B2A4D 0%, #C8794E 50%, #C9892C 100%)`) so the
 * goal-hit moment looks identical across platforms.
 */
describe("AccentWinGradient (win-moment fill)", () => {
  it("has the three Sloe brand-gradient stops in paint order", () => {
    expect(AccentWinGradient.stops).toEqual(["#3B2A4D", "#C8794E", "#C9892C"]);
  });

  it("the middle (clay) stop is the Sloe primary CTA hue", () => {
    expect(AccentWinGradient.stops[1]).toBe("#C8794E");
  });

  it("offsets mirror the web 0% / 50% / 100% stop positions", () => {
    expect(AccentWinGradient.offsets).toEqual([0, 0.5, 1]);
  });
});
