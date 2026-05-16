import { describe, it, expect } from "vitest";
import { fastingStageNarrative } from "../../src/lib/nutrition/fastingStageNarrative";

const h = (n: number): number => n * 3_600_000;

describe("fastingStageNarrative — stage buckets (ENG-52)", () => {
  it("handles 0 ms (just started) — early digesting", () => {
    expect(fastingStageNarrative(0)).toMatch(/digest/i);
  });

  it("handles negative input defensively (clock-skew) — falls into the earliest bucket", () => {
    expect(fastingStageNarrative(-1_000)).toMatch(/digest/i);
  });

  it("3h 59m → digesting (under 4h boundary)", () => {
    expect(fastingStageNarrative(h(3) + h(0.98))).toMatch(/digest/i);
  });

  it("4h → glycogen draw-down (4h boundary inclusive)", () => {
    expect(fastingStageNarrative(h(4))).toMatch(/glycogen.*draw/i);
  });

  it("8h → glycogen shift bucket", () => {
    expect(fastingStageNarrative(h(8))).toMatch(/glycogen/i);
  });

  it("12h → fat-metabolism-may-pick-up bucket", () => {
    expect(fastingStageNarrative(h(12))).toMatch(/fat metabolism/i);
  });

  it("16h → fat oxidation + mild ketosis bucket", () => {
    expect(fastingStageNarrative(h(16))).toMatch(/fat oxidation/i);
  });

  it("20h → ketones + growth hormone bucket", () => {
    expect(fastingStageNarrative(h(20))).toMatch(/ketones|growth hormone/i);
  });

  it("24h → autophagy bucket", () => {
    expect(fastingStageNarrative(h(24))).toMatch(/autophagy/i);
  });

  it("48h → extended fast territory", () => {
    expect(fastingStageNarrative(h(48))).toMatch(/extended/i);
  });
});

describe("fastingStageNarrative — copy posture (ENG-52)", () => {
  // Pins that the narrative copy stays hedged ("may", "often",
  // "typically", "tends to", "starting to", "shifting", "draw down") and
  // never asserts an absolute physiological claim. A future contributor
  // who inserts "your body burns fat" or similar gets flagged at CI.
  it("never uses absolute physiology claims", () => {
    const absolutes = [
      /^your body (is|will)/i,
      /your body burns/i,
      /you (will|are) (burn|enter)/i,
      /this is happening/i,
      /always /i,
      /never /i,
      /must /i,
      /guaranteed/i,
      /proven /i,
    ];
    for (let hr = 0; hr < 50; hr++) {
      const line = fastingStageNarrative(h(hr));
      for (const pattern of absolutes) {
        expect(line, `Hour ${hr} narrative: "${line}" matched forbidden pattern ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("each line is ≤ 80 chars (tight UI fit below fasting ring)", () => {
    for (let hr = 0; hr < 50; hr += 2) {
      const line = fastingStageNarrative(h(hr));
      expect(line.length, `Hour ${hr}: "${line}" exceeds 80 chars`).toBeLessThanOrEqual(80);
    }
  });
});
