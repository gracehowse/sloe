import { describe, it, expect } from "vitest";

import { Elevation } from "../../constants/theme";

/**
 * ENG-795 (Redesign — Design Direction 2026): the soft-elevation token must
 * be a real soft shadow. `Elevation.card` was silently zeroed once (the
 * 2026-05-22 flat lock); this guards the soft variant so it can't regress to
 * a no-op the way the flat one did. SupprCard applies `cardSoft` (light) when
 * the `design_system_elevation` flag is on, keeping the flat `card` as the
 * flag-off fallback.
 */
describe("Elevation tokens", () => {
  it("cardSoft is a real soft shadow (never silently zeroed)", () => {
    expect(Elevation.cardSoft.shadowOpacity).toBeGreaterThan(0);
    expect(Elevation.cardSoft.shadowRadius).toBeGreaterThanOrEqual(10);
    expect(Elevation.cardSoft.shadowOffset.height).toBeGreaterThan(0);
  });

  it("flat card stays flat — the flag-off fallback / 2026-05-22 lock", () => {
    expect(Elevation.card.shadowOpacity).toBe(0);
  });
});
