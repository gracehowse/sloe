/**
 * ringPhase — the hero ring's state machine (SPEC 1) + haptic event
 * contract: upward entries only, highest milestone wins, downward silent.
 */
import { describe, expect, it } from "vitest";
import {
  RING_NEAR_RATIO,
  RING_OVERFLOW_RATIO,
  ringPhase,
  ringPhaseEvent,
} from "../../src/lib/nutrition/ringPhase";

describe("ringPhase", () => {
  it("maps the spec bands: empty → filling → near (90–99%) → hit (100%) → overflow", () => {
    expect(ringPhase(0, 2000)).toBe("empty");
    expect(ringPhase(100, 0)).toBe("empty");
    expect(ringPhase(1000, 2000)).toBe("filling");
    expect(ringPhase(1799, 2000)).toBe("filling"); // 89.95%
    expect(ringPhase(1800, 2000)).toBe("near"); // 90%
    expect(ringPhase(1999, 2000)).toBe("near");
    expect(ringPhase(2000, 2000)).toBe("hit"); // dead on goal
    expect(ringPhase(2030, 2000)).toBe("hit"); // inside the 2% grace band
    expect(ringPhase(2041, 2000)).toBe("overflow"); // past 1.02
    expect(RING_NEAR_RATIO).toBe(0.9);
    expect(RING_OVERFLOW_RATIO).toBe(1.02);
  });

  it("treats non-finite input as empty (no broken UI from bad upstream data)", () => {
    expect(ringPhase(NaN, 2000)).toBe("empty");
    expect(ringPhase(500, Infinity)).toBe("empty"); // non-finite goal → safest state
    expect(ringPhase(Infinity, 2000)).toBe("empty");
  });
});

describe("ringPhaseEvent — upward entries only, highest milestone wins", () => {
  it("fires near on entering the 90% band", () => {
    expect(ringPhaseEvent("filling", "near")).toBe("near");
  });

  it("fires the hit beat on crossing 100% — from anywhere below", () => {
    expect(ringPhaseEvent("near", "hit")).toBe("hit");
    expect(ringPhaseEvent("filling", "hit")).toBe("hit");
    // one big log from 80% straight past 102%: the WIN fires, not overflow
    expect(ringPhaseEvent("filling", "overflow")).toBe("hit");
    expect(ringPhaseEvent("near", "overflow")).toBe("hit");
    expect(ringPhaseEvent("empty", "overflow")).toBe("hit");
  });

  it("fires overflow only when growing FROM hit", () => {
    expect(ringPhaseEvent("hit", "overflow")).toBe("overflow");
  });

  it("downward transitions (deleting food) fire nothing", () => {
    expect(ringPhaseEvent("hit", "near")).toBeNull();
    expect(ringPhaseEvent("overflow", "filling")).toBeNull();
    expect(ringPhaseEvent("near", "filling")).toBeNull();
    expect(ringPhaseEvent("filling", "filling")).toBeNull();
    expect(ringPhaseEvent("overflow", "overflow")).toBeNull();
  });

  it("empty → filling is silent (data landing isn't a milestone)", () => {
    expect(ringPhaseEvent("empty", "filling")).toBeNull();
  });
});
