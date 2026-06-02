import { describe, it, expect } from "vitest";

import { Accent, AccentWinGradient } from "../../constants/theme";

/**
 * ENG-795 → Design Direction 2026 (`docs/decisions/2026-06-01-design-direction-
 * 2026.md`). The win / celebration role is a DISTINCT landmark-only hue,
 * intentionally outside the 8-slot action palette. It must never collapse onto
 * the commit-CTA colour (`primary`) or the state/data colour (`success`) —
 * that three-role split is the whole point of the token. The 2026-06-01
 * direction retired BOTH the interim amber `#F2A93B` and the briefly-shipped
 * gold in favour of the BRAND SPECTRUM (solid `#9679D9` brand-purple + a
 * blue→purple→magenta 3-stop gradient) — most ownable, collision-free with the
 * carbs/sodium/over-budget orange family. Mirrors web `--accent-win`
 * / `--accent-win-gradient` in `src/styles/theme.css`.
 */
describe("Accent win token", () => {
  it("win is its own hue — distinct from success (state/data colour)", () => {
    expect(Accent.win).not.toBe(Accent.success);
  });

  it("win is its own hue — distinct from primary (commit-CTA colour)", () => {
    expect(Accent.win).not.toBe(Accent.primary);
  });

  it("win is its own hue — distinct from the carbs/sodium warm-orange family", () => {
    // The win hue must not be confused with carbs (#E8721E), sodium, or the
    // over-budget warning orange — that collision is exactly why gold/amber were
    // retired in favour of the brand spectrum (2026-06-01).
    expect(Accent.win).not.toBe(Accent.carbs);
    expect(Accent.win).not.toBe(Accent.warning);
    expect(Accent.win).not.toBe(Accent.orange);
  });

  it("win is the agreed brand purple and winSoft is its alpha form", () => {
    expect(Accent.win).toBe("#9679D9");
    expect(Accent.winSoft).toBe("rgba(150, 121, 217, 0.12)");
  });

  it("the retired interim amber is gone (no #F2A93B / amber alpha anywhere)", () => {
    expect(Accent.win).not.toBe("#F2A93B");
    expect(Accent.winSoft).not.toBe("rgba(242, 169, 59, 0.12)");
  });
});

/**
 * The celebration FILL is a 3-stop BRAND-SPECTRUM gradient. The stops + offsets
 * must match web `--accent-win-gradient`
 * (`linear-gradient(120deg, #588CE4 0%, #9679D9 50%, #DF5EBC 100%)`) so the
 * goal-hit moment looks identical across platforms.
 */
describe("AccentWinGradient (win-moment fill)", () => {
  it("has the three approved brand-spectrum stops in paint order", () => {
    expect(AccentWinGradient.stops).toEqual(["#588CE4", "#9679D9", "#DF5EBC"]);
  });

  it("the brand-purple middle stop matches the solid Accent.win text/number value", () => {
    expect(AccentWinGradient.stops[1]).toBe(Accent.win);
  });

  it("offsets mirror the web 0% / 50% / 100% stop positions", () => {
    expect(AccentWinGradient.offsets).toEqual([0, 0.5, 1]);
  });
});
