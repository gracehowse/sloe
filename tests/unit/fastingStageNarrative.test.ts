import { describe, it, expect } from "vitest";
import {
  fastingStageDisclosure,
  fastingStageNarrative,
} from "../../src/lib/nutrition/fastingStageNarrative";

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

  it("24h → autophagy bucket, framed as population evidence (ENG-1028)", () => {
    const line = fastingStageNarrative(h(24));
    expect(line).toMatch(/autophagy/i);
    // ENG-1028 — population framing, not a personal claim. Names that the
    // evidence is from studies (mostly animal) rather than asserting it's
    // happening to this user.
    expect(line).toMatch(/in studies/i);
    expect(line).toMatch(/animal/i);
    // No human-benefit claim — never says the user gains anything.
    expect(line).not.toMatch(/cleans|repair|detox|renew|benefit/i);
  });

  it("48h → extended fast territory", () => {
    expect(fastingStageNarrative(h(48))).toMatch(/extended/i);
  });
});

// ─── ENG-1028: "how we know this" disclosure ─────────────────────────────
describe("fastingStageDisclosure (ENG-1028)", () => {
  it("returns a disclosure line only for the autophagy stage (24–36h)", () => {
    // Below 24h and at/above 36h: no disclosure (well-established stages).
    expect(fastingStageDisclosure(h(23))).toBeNull();
    expect(fastingStageDisclosure(h(16))).toBeNull();
    expect(fastingStageDisclosure(h(0))).toBeNull();
    expect(fastingStageDisclosure(h(36))).toBeNull();
    expect(fastingStageDisclosure(h(48))).toBeNull();

    // Inside the autophagy window: a disclosure naming the evidence gap.
    const d = fastingStageDisclosure(h(24));
    expect(d).not.toBeNull();
    expect(d!).toMatch(/how we know this/i);
    expect(d!).toMatch(/isn't established/i);
    expect(d!).toMatch(/animal/i);
    // No benefit / prescription / shaming language.
    expect(d!).not.toMatch(/should|must|cleanse|detox|cure/i);
  });

  it("disclosure is present across the whole 24–36h band", () => {
    expect(fastingStageDisclosure(h(30))).not.toBeNull();
    expect(fastingStageDisclosure(h(35.9))).not.toBeNull();
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
