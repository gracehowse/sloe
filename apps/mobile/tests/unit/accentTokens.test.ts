import { describe, it, expect } from "vitest";

import { Accent } from "../../constants/theme";

/**
 * ENG-795 (Redesign — Design Direction 2026, 2026-05-31). The win /
 * celebration role is a DISTINCT landmark-only hue, intentionally outside the
 * 8-slot action palette. It must never collapse onto the commit-CTA colour
 * (`primary`) or the state/data colour (`success`) — that three-role split is
 * the whole point of the token. Mirrors web `--accent-win` in
 * `src/styles/theme.css`.
 */
describe("Accent win token", () => {
  it("win is its own hue — distinct from success (state/data colour)", () => {
    expect(Accent.win).not.toBe(Accent.success);
  });

  it("win is its own hue — distinct from primary (commit-CTA colour)", () => {
    expect(Accent.win).not.toBe(Accent.primary);
  });

  it("win is the agreed warm-amber and winSoft is its alpha form", () => {
    expect(Accent.win).toBe("#F2A93B");
    expect(Accent.winSoft).toBe("rgba(242, 169, 59, 0.12)");
  });
});
