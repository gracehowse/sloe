/**
 * ENG-1525 — `trendDirectionTone` shared helper pins.
 *
 * The single direction-aware colour source for the Progress hierarchy:
 * §1 Trajectory hero rate/verdict tone and §3 Energy deficit/surplus
 * framing both read this (web directly, mobile via the
 * `@suppr/shared/weightProjection` re-export). Pins:
 *   - toward/away for both loss and gain goals (sign-of-gap logic)
 *   - neutral when there's no goal weight or no latest weight
 *   - neutral at zero and near-zero rates (the 0.05 kg/week epsilon)
 *   - neutral when already at goal (no amber for maintaining)
 *   - never any value outside toward | away | neutral (no red bucket)
 */
import { describe, expect, it } from "vitest";

import {
  TREND_DIRECTION_EPSILON_KG_PER_WEEK,
  trendDirectionTone,
} from "../../src/lib/weightProjection";

describe("trendDirectionTone (ENG-1525)", () => {
  it("loss goal + losing (negative rate) → toward", () => {
    // latest 80 kg, goal 72 kg, losing 0.4 kg/week
    expect(trendDirectionTone(-0.4, 80, 72)).toBe("toward");
  });

  it("loss goal + gaining (positive rate) → away", () => {
    expect(trendDirectionTone(0.4, 80, 72)).toBe("away");
  });

  it("gain goal + gaining (positive rate) → toward", () => {
    // latest 60 kg, goal 66 kg, gaining 0.3 kg/week
    expect(trendDirectionTone(0.3, 60, 66)).toBe("toward");
  });

  it("gain goal + losing (negative rate) → away", () => {
    expect(trendDirectionTone(-0.3, 60, 66)).toBe("away");
  });

  it("no goal weight → neutral, whatever the rate", () => {
    expect(trendDirectionTone(-0.5, 80, null)).toBe("neutral");
    expect(trendDirectionTone(0.5, 80, undefined)).toBe("neutral");
  });

  it("no latest weight → neutral (never invent a direction)", () => {
    expect(trendDirectionTone(-0.5, null, 72)).toBe("neutral");
    expect(trendDirectionTone(-0.5, undefined, 72)).toBe("neutral");
  });

  it("zero rate → neutral", () => {
    expect(trendDirectionTone(0, 80, 72)).toBe("neutral");
  });

  it("near-zero rate under the epsilon → neutral (both signs)", () => {
    const nearZero = TREND_DIRECTION_EPSILON_KG_PER_WEEK / 2;
    expect(trendDirectionTone(-nearZero, 80, 72)).toBe("neutral");
    expect(trendDirectionTone(nearZero, 80, 72)).toBe("neutral");
  });

  it("rate exactly at the epsilon counts as a direction", () => {
    expect(
      trendDirectionTone(-TREND_DIRECTION_EPSILON_KG_PER_WEEK, 80, 72),
    ).toBe("toward");
  });

  it("already at goal (within tolerance) → neutral, not away", () => {
    expect(trendDirectionTone(-0.4, 72.02, 72)).toBe("neutral");
    expect(trendDirectionTone(0.4, 72, 72)).toBe("neutral");
  });

  it("non-finite inputs → neutral", () => {
    expect(trendDirectionTone(Number.NaN, 80, 72)).toBe("neutral");
    expect(trendDirectionTone(-0.4, Number.NaN, 72)).toBe("neutral");
    expect(trendDirectionTone(-0.4, 80, Number.POSITIVE_INFINITY)).toBe(
      "neutral",
    );
    expect(trendDirectionTone(null, 80, 72)).toBe("neutral");
  });
});
