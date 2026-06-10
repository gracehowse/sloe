/**
 * Fasting stages — pinned 2026-06-07 (Sloe DS migration, Figma 305:2).
 *
 * Backs the "Fasting stages" progress bar + current-stage chip on the
 * full fasting timer (web + mobile) and the stage dot on the Today
 * fasting card. Keeping the stage thresholds pure means both platforms
 * share one definition and the bar / chip / narrative never contradict.
 */
import { describe, expect, it } from "vitest";
import {
  FASTING_STAGES,
  fastingStageAtHours,
  fastingStageBarFraction,
} from "../../src/lib/fasting/stages";

describe("FASTING_STAGES", () => {
  it("is the canonical ordered list (Fed → Fat burning → Ketosis → Deep)", () => {
    expect(FASTING_STAGES.map((s) => s.id)).toEqual([
      "fed",
      "fatBurning",
      "ketosis",
      "deep",
    ]);
    expect(FASTING_STAGES.map((s) => s.label)).toEqual([
      "Fed",
      "Fat burning",
      "Ketosis",
      "Deep",
    ]);
  });

  it("has strictly ascending stage start hours (fastingStageAtHours relies on this)", () => {
    expect(FASTING_STAGES.map((s) => s.startHour)).toEqual([0, 4, 12, 16]);
    for (let i = 1; i < FASTING_STAGES.length; i += 1) {
      expect(FASTING_STAGES[i].startHour).toBeGreaterThan(
        FASTING_STAGES[i - 1].startHour,
      );
    }
  });
});

describe("fastingStageAtHours", () => {
  it("a just-started fast is in the Fed stage (index 0)", () => {
    expect(fastingStageAtHours(0)).toMatchObject({ index: 0 });
    expect(fastingStageAtHours(3.99).stage.id).toBe("fed");
  });

  it("4h enters Fat burning", () => {
    expect(fastingStageAtHours(4).stage.id).toBe("fatBurning");
    expect(fastingStageAtHours(11.99).stage.id).toBe("fatBurning");
  });

  it("12h enters Ketosis, 16h enters Deep", () => {
    expect(fastingStageAtHours(12).stage.id).toBe("ketosis");
    expect(fastingStageAtHours(16).stage.id).toBe("deep");
    // OMAD (23h) sits in the Deep stage — the final stage caps out.
    expect(fastingStageAtHours(23).stage.id).toBe("deep");
  });

  it("clamps negative / non-finite elapsed to the Fed stage (clock-skew defence)", () => {
    expect(fastingStageAtHours(-5).stage.id).toBe("fed");
    expect(fastingStageAtHours(Number.NaN).stage.id).toBe("fed");
    expect(fastingStageAtHours(Number.POSITIVE_INFINITY).stage.id).toBe("fed");
  });
});

describe("fastingStageBarFraction", () => {
  it("is 0 at the start and 1 at (or past) the window goal", () => {
    expect(fastingStageBarFraction(0, 16)).toBe(0);
    expect(fastingStageBarFraction(8, 16)).toBeCloseTo(0.5, 5);
    expect(fastingStageBarFraction(16, 16)).toBe(1);
    expect(fastingStageBarFraction(20, 16)).toBe(1); // capped — never past the goal
  });

  it("works for the OMAD window (23h)", () => {
    expect(fastingStageBarFraction(0, 23)).toBe(0);
    expect(fastingStageBarFraction(23, 23)).toBe(1);
    expect(fastingStageBarFraction(11.5, 23)).toBeCloseTo(0.5, 5);
  });

  it("returns 0 for a non-positive / non-finite window (no preset selected)", () => {
    expect(fastingStageBarFraction(8, 0)).toBe(0);
    expect(fastingStageBarFraction(8, -16)).toBe(0);
    expect(fastingStageBarFraction(8, Number.NaN)).toBe(0);
  });

  it("clamps negative elapsed to 0", () => {
    expect(fastingStageBarFraction(-3, 16)).toBe(0);
  });
});
