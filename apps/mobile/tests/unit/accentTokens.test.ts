import { describe, it, expect } from "vitest";

import {
  Accent,
  AccentFrost,
  AccentWinGradient,
  AccentWinGradientFrost,
} from "../../constants/theme";

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

/**
 * FROST secondary-colour direction — FLAG-GATED (`brand_frost_secondary`).
 * Exploration only (`docs/brand/2026-06-07-secondary-colour-exploration.md`).
 * `AccentFrost` moves ONLY the secondary-accent keys clay → Damson; every other
 * role (carbs/sugar = clay, status, fiber, win, activity/honey) stays identical
 * to `Accent`. These tests are the regression guard: if a future edit lets the
 * Frost swap leak into carbs/sugar/status, the build fails. Mirrors the web
 * `.flag-frost` block in `src/styles/theme.css`.
 */
describe("AccentFrost (Frost secondary-accent flag palette)", () => {
  it("moves the secondary-accent keys clay → Damson", () => {
    expect(AccentFrost.primary).toBe("#6A4B7A");
    expect(AccentFrost.primaryLight).toBe("#9A7BAA");
    expect(AccentFrost.primarySolid).toBe("#54356A");
    expect(AccentFrost.primarySolidDark).toBe("#B6ACC6");
    expect(AccentFrost.primarySoft).toBe("rgba(106, 75, 122, 0.10)");
    expect(AccentFrost.primarySoftDark).toBe("rgba(154, 123, 170, 0.16)");
    expect(AccentFrost.brandBlue).toBe("#6A4B7A");
    expect(AccentFrost.brandBlueLight).toBe("#9A7BAA");
  });

  it("the moved keys differ from the clay Accent (the swap actually happened)", () => {
    expect(AccentFrost.primary).not.toBe(Accent.primary);
    expect(AccentFrost.primarySolid).not.toBe(Accent.primarySolid);
    expect(AccentFrost.brandBlue).not.toBe(Accent.brandBlue);
  });

  it("carbs + sugar STAY clay in the Frost palette (regression guard)", () => {
    // The macro identity colour must NOT move in either flag state.
    expect(AccentFrost.carbs).toBe(Accent.carbs);
    expect(AccentFrost.carbs).toBe("#C8794E");
    expect(AccentFrost.carbsLight).toBe(Accent.carbsLight);
  });

  it("status / fiber / win / honey roles are untouched by Frost", () => {
    expect(AccentFrost.success).toBe(Accent.success);
    expect(AccentFrost.warning).toBe(Accent.warning);
    expect(AccentFrost.destructive).toBe(Accent.destructive);
    expect(AccentFrost.fiber).toBe(Accent.fiber);
    expect(AccentFrost.win).toBe(Accent.win);
    expect(AccentFrost.winSoft).toBe(Accent.winSoft);
    expect(AccentFrost.activity).toBe(Accent.activity);
    expect(AccentFrost.activitySolid).toBe(Accent.activitySolid);
    expect(AccentFrost.info).toBe(Accent.info);
  });

  it("ONLY the eight secondary-accent keys differ from Accent — nothing else", () => {
    const movedKeys = new Set([
      "primary",
      "primaryLight",
      "primarySolid",
      "primarySolidDark",
      "primarySoft",
      "primarySoftDark",
      "brandBlue",
      "brandBlueLight",
    ]);
    const drifted = (Object.keys(Accent) as (keyof typeof Accent)[]).filter(
      (k) => Accent[k] !== AccentFrost[k],
    );
    expect(new Set(drifted)).toEqual(movedKeys);
  });
});

/**
 * The Frost win-moment gradient shifts ONLY the mid clay stop to damson; the
 * plum + honey ends and the offsets are unchanged. Mirrors the web
 * `.flag-frost --accent-win-gradient`.
 */
describe("AccentWinGradientFrost (Frost win-moment fill)", () => {
  it("has plum → damson → honey stops in paint order", () => {
    expect(AccentWinGradientFrost.stops).toEqual(["#3B2A4D", "#6A4B7A", "#D6A24A"]);
  });

  it("the middle stop moved clay → damson; the ends held", () => {
    expect(AccentWinGradientFrost.stops[0]).toBe(AccentWinGradient.stops[0]); // plum held
    expect(AccentWinGradientFrost.stops[1]).toBe("#6A4B7A"); // clay → damson
    expect(AccentWinGradientFrost.stops[1]).not.toBe(AccentWinGradient.stops[1]);
  });

  it("offsets are unchanged from the clay gradient", () => {
    expect(AccentWinGradientFrost.offsets).toEqual(AccentWinGradient.offsets);
  });
});
