/**
 * Progress empty-state contract — cross-surface regression test.
 *
 * Authority: ENG-97 +
 * `docs/decisions/2026-05-13-progress-empty-state-contract.md`.
 *
 * The 2026-04-30 audit found Progress fabricating "Maintenance held
 * steady · high confidence" with zero logged data. The individual
 * gates were already in place, but the contract was implicit. This
 * suite makes the cross-surface guarantee explicit: with no logs and
 * no weigh-ins, no Progress surface emits confidence-laden language.
 */

import { describe, expect, it } from "vitest";
import { computeAdaptiveTDEE } from "../../src/lib/nutrition/adaptiveTdee";
import {
  hasEnoughDataForAdaptiveTDEE,
  hasEnoughDataForStory,
  hasEnoughWeighInsForTrend,
} from "../../src/lib/nutrition/progressDataContract";
import { generateProgressCommentary } from "../../src/lib/nutrition/progressCommentary";

describe("Progress empty-state — zero-data fail-closed contract", () => {
  it("hasEnoughDataForStory rejects an empty week", () => {
    expect(hasEnoughDataForStory(0)).toBe(false);
  });

  it("the AVERAGE ADHERENCE card is gated on a meaningful range sample (web + mobile)", () => {
    // A single stray logged day used to render a confident "AVERAGE ADHERENCE
    // 109%" headline next to the "building your story / 0 days logged" gate.
    // Both surfaces must now gate the adherence card on
    // hasEnoughDataForStory(caloriesRange.daysLogged) so the average only shows
    // with a real sample. (The component already returns null on a null pct.)
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const web = readFileSync(
      `${__dirname}/../../src/app/components/ProgressDashboard.tsx`,
      "utf8",
    );
    const mobile = readFileSync(
      `${__dirname}/../../apps/mobile/app/(tabs)/progress.tsx`,
      "utf8",
    );
    const gate =
      /hasEnoughDataForStory\(caloriesRange\.daysLogged\)\s*\?\s*caloriesRange\.adherencePct\s*:\s*null/;
    expect(web).toMatch(gate);
    expect(mobile).toMatch(gate);
  });

  it("computeAdaptiveTDEE returns null on an empty input", () => {
    expect(
      computeAdaptiveTDEE({
        intakeByDay: {},
        weightByDay: {},
      }),
    ).toBeNull();
  });

  it("hasEnoughDataForAdaptiveTDEE rejects an empty input", () => {
    expect(
      hasEnoughDataForAdaptiveTDEE({ loggingDays: 0, weighInCount: 0 }),
    ).toBe(false);
  });

  it("hasEnoughWeighInsForTrend rejects zero / one weigh-ins", () => {
    expect(hasEnoughWeighInsForTrend(0)).toBe(false);
    expect(hasEnoughWeighInsForTrend(1)).toBe(false);
  });

  it("generateProgressCommentary with null current → calibrating regime, no confidence claim", () => {
    const out = generateProgressCommentary({
      current: null,
      loggingDays: 0,
    });
    expect(out.regime).toBe("calibrating");
    expect(out.hasMaintenanceEstimate).toBe(false);
    expect(out.confidence).toBe("low");
    expect(out.headline.toLowerCase()).not.toContain("high confidence");
    expect(out.body.toLowerCase()).not.toContain("high confidence");
    expect(out.headline.toLowerCase()).not.toMatch(/held steady/);
  });

  it("generateProgressCommentary in calibrating regime never quotes a confidence-tier TDEE", () => {
    // Simulate a user with a low-confidence engine result.
    const out = generateProgressCommentary({
      current: {
        tdee: 2100,
        confidence: "low",
        loggingDays: 7,
        weighInCount: 3,
        avgDailyIntake: 0,
        smoothedWeightChangeKgPerDay: 0,
        windowDays: 28,
      },
      loggingDays: 7,
    });
    expect(out.regime).toBe("calibrating");
    expect(out.confidence).toBe("low");
    // Calibrating copy may reference the early estimate, but it
    // must never claim "high" or "medium" confidence on it.
    expect(out.headline.toLowerCase()).not.toContain("high confidence");
    expect(out.headline.toLowerCase()).not.toContain("medium confidence");
    expect(out.body.toLowerCase()).not.toContain("high confidence");
    expect(out.body.toLowerCase()).not.toContain("medium confidence");
  });
});
