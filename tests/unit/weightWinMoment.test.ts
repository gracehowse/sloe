/**
 * ENG-824 (Redesign — Design Direction 2026, 2026-05-31 design-director
 * review) — the shared new-weight-low landmark detector.
 *
 * Pure-logic unit tests for `isNewWeightLow` / `priorLowestKg`. The win-moment
 * is RESERVED for genuine landmarks, so the edge contract matters: a re-save
 * that doesn't beat the low, and the first-ever weigh-in, must NOT fire; only a
 * strict new low does. Web + mobile both consume this exact function so they
 * celebrate on identical conditions — this test is the single source of truth
 * for those conditions.
 */
import { describe, expect, it } from "vitest";

import {
  isNewWeightLow,
  priorLowestKg,
  NEW_LOW_EPSILON_KG,
} from "../../src/lib/nutrition/weightWinMoment";

const TODAY = "2026-05-31";

describe("priorLowestKg", () => {
  it("returns the minimum positive weight, excluding the written date", () => {
    const map = { "2026-05-28": 80, "2026-05-29": 78.5, "2026-05-30": 79 };
    expect(priorLowestKg(map, TODAY)).toBe(78.5);
  });

  it("excludes the target date so an edit isn't compared to its own stale value", () => {
    // The date being written holds a stale low; it must not count as the prior
    // minimum (otherwise correcting today's value down could never be a low,
    // and correcting it up could spuriously read the old value as the floor).
    const map = { "2026-05-29": 80, [TODAY]: 70 };
    expect(priorLowestKg(map, TODAY)).toBe(80);
  });

  it("ignores zero / negative / non-finite values", () => {
    const map = { a: 0, b: -5, c: Number.NaN, d: 77 };
    expect(priorLowestKg(map, TODAY)).toBe(77);
  });

  it("returns null when there is no prior baseline", () => {
    expect(priorLowestKg({}, TODAY)).toBeNull();
    expect(priorLowestKg({ [TODAY]: 75 }, TODAY)).toBeNull();
  });
});

describe("isNewWeightLow", () => {
  it("fires when the saved weight is strictly below the prior minimum", () => {
    expect(
      isNewWeightLow({
        savedKg: 77.0,
        priorByDay: { "2026-05-29": 78.5, "2026-05-30": 79 },
        targetDateKey: TODAY,
      }),
    ).toBe(true);
  });

  it("does NOT fire on the first-ever weigh-in (no baseline to beat)", () => {
    expect(
      isNewWeightLow({ savedKg: 75, priorByDay: {}, targetDateKey: TODAY }),
    ).toBe(false);
  });

  it("does NOT fire when re-saving a value that ties or exceeds the prior low", () => {
    const priorByDay = { "2026-05-29": 78, "2026-05-30": 78.5 };
    // Equal to the low — not a new low.
    expect(isNewWeightLow({ savedKg: 78, priorByDay, targetDateKey: TODAY })).toBe(false);
    // Above the low — not a new low.
    expect(isNewWeightLow({ savedKg: 80, priorByDay, targetDateKey: TODAY })).toBe(false);
  });

  it("does NOT fire for a sub-epsilon improvement (guards kg↔lb round-trip dither)", () => {
    const priorByDay = { "2026-05-30": 78.0 };
    // 78.0 - 78.0 + tiny float noise: just inside the epsilon → no celebration.
    expect(
      isNewWeightLow({
        savedKg: 78.0 - NEW_LOW_EPSILON_KG / 2,
        priorByDay,
        targetDateKey: TODAY,
      }),
    ).toBe(false);
  });

  it("fires for an improvement larger than the epsilon", () => {
    const priorByDay = { "2026-05-30": 78.0 };
    expect(
      isNewWeightLow({
        savedKg: 78.0 - NEW_LOW_EPSILON_KG * 2,
        priorByDay,
        targetDateKey: TODAY,
      }),
    ).toBe(true);
  });

  it("judges an edit of today's entry against the rest of history, not itself", () => {
    // Today already holds 76 (a prior low for the day). Correcting it DOWN to
    // 74 beats the other days' minimum (75) → new low. Correcting it UP to 80
    // does not.
    const priorByDay = { "2026-05-29": 75, "2026-05-30": 76, [TODAY]: 76 };
    expect(isNewWeightLow({ savedKg: 74, priorByDay, targetDateKey: TODAY })).toBe(true);
    expect(isNewWeightLow({ savedKg: 80, priorByDay, targetDateKey: TODAY })).toBe(false);
  });

  it("rejects non-positive / non-finite saved values", () => {
    const priorByDay = { "2026-05-30": 78 };
    expect(isNewWeightLow({ savedKg: 0, priorByDay, targetDateKey: TODAY })).toBe(false);
    expect(isNewWeightLow({ savedKg: -1, priorByDay, targetDateKey: TODAY })).toBe(false);
    expect(isNewWeightLow({ savedKg: Number.NaN, priorByDay, targetDateKey: TODAY })).toBe(false);
  });
});
