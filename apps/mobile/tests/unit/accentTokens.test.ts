import { describe, it, expect } from "vitest";

import { Accent, AccentWinGradient } from "../../constants/theme";

/**
 * ENG-795 → Design Direction 2026 (`docs/decisions/2026-06-01-design-direction-
 * 2026.md`). The win / celebration role is a DISTINCT landmark-only GOLD,
 * intentionally outside the 8-slot action palette. It must never collapse onto
 * the commit-CTA colour (`primary`) or the state/data colour (`success`) —
 * that three-role split is the whole point of the token. The 2026-06-01
 * direction also retires the interim amber `#F2A93B` in favour of deep gold
 * `#C99A22` + a 3-stop gradient (gold reads as *achievement*; amber collided
 * with the carbs/sodium/over-budget orange family). Mirrors web `--accent-win`
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
    // Gold must not be confused with carbs (#E8721E), sodium, or the
    // over-budget warning orange — that separation is why amber was retired.
    expect(Accent.win).not.toBe(Accent.carbs);
    expect(Accent.win).not.toBe(Accent.warning);
    expect(Accent.win).not.toBe(Accent.orange);
  });

  it("win is the agreed deep gold and winSoft is its alpha form", () => {
    expect(Accent.win).toBe("#C99A22");
    expect(Accent.winSoft).toBe("rgba(201, 154, 34, 0.12)");
  });

  it("the retired interim amber is gone (no #F2A93B / amber alpha anywhere)", () => {
    expect(Accent.win).not.toBe("#F2A93B");
    expect(Accent.winSoft).not.toBe("rgba(242, 169, 59, 0.12)");
  });
});

/**
 * The celebration FILL is a 3-stop gradient (a flat gold reads mustard). The
 * stops + offsets must match web `--accent-win-gradient`
 * (`linear-gradient(150deg, #F8E08A 0%, #E7C25C 45%, #C99A22 100%)`) so the
 * goal-hit moment looks identical across platforms.
 */
describe("AccentWinGradient (win-moment fill)", () => {
  it("has the three approved gold stops in paint order", () => {
    expect(AccentWinGradient.stops).toEqual(["#F8E08A", "#E7C25C", "#C99A22"]);
  });

  it("deep-gold final stop matches the solid Accent.win text/number value", () => {
    expect(AccentWinGradient.stops[AccentWinGradient.stops.length - 1]).toBe(
      Accent.win,
    );
  });

  it("offsets mirror the web 0% / 45% / 100% stop positions", () => {
    expect(AccentWinGradient.offsets).toEqual([0, 0.45, 1]);
  });
});
