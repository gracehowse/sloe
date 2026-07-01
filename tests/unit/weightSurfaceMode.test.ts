import { describe, expect, it } from "vitest";
import {
  coerceWeightSurfaceMode,
  decideWeightSurface,
  formatLoggingConsistencyValue,
  weightTrendDirection,
  WEIGHT_TRENDS_STABLE_KG,
  type WeightSurfaceMode,
} from "../../src/lib/nutrition/weightSurfaceMode";

/**
 * T13 — pins the three-mode policy on weight rendering.
 * Closes DI-P0-03 (diversity-inclusion audit); ED / dysphoria-sensitive.
 */

describe("coerceWeightSurfaceMode", () => {
  it("accepts the 3 canonical modes unchanged", () => {
    expect(coerceWeightSurfaceMode("show")).toBe("show");
    expect(coerceWeightSurfaceMode("hide")).toBe("hide");
    expect(coerceWeightSurfaceMode("trends_only")).toBe("trends_only");
  });

  it("defaults to 'show' for null / undefined / unknown / wrong-type inputs", () => {
    expect(coerceWeightSurfaceMode(null)).toBe("show");
    expect(coerceWeightSurfaceMode(undefined)).toBe("show");
    expect(coerceWeightSurfaceMode("")).toBe("show");
    expect(coerceWeightSurfaceMode("Show")).toBe("show"); // case-sensitive on purpose — DB check constraint is case-sensitive
    expect(coerceWeightSurfaceMode("invisible")).toBe("show");
    expect(coerceWeightSurfaceMode(42)).toBe("show");
    expect(coerceWeightSurfaceMode({})).toBe("show");
  });
});

describe("weightTrendDirection", () => {
  it("returns null when deltaKg is missing or non-finite", () => {
    expect(weightTrendDirection(null)).toBeNull();
    expect(weightTrendDirection(undefined)).toBeNull();
    expect(weightTrendDirection(Number.NaN)).toBeNull();
    expect(weightTrendDirection(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("returns 'stable' when |delta| is below the stable threshold", () => {
    expect(weightTrendDirection(0)).toBe("stable");
    expect(weightTrendDirection(0.1)).toBe("stable");
    expect(weightTrendDirection(-0.29)).toBe("stable");
  });

  it("returns 'down' for negative deltas at or above the threshold", () => {
    expect(weightTrendDirection(-WEIGHT_TRENDS_STABLE_KG)).toBe("down");
    expect(weightTrendDirection(-0.5)).toBe("down");
    expect(weightTrendDirection(-2)).toBe("down");
  });

  it("returns 'up' for positive deltas at or above the threshold", () => {
    expect(weightTrendDirection(WEIGHT_TRENDS_STABLE_KG)).toBe("up");
    expect(weightTrendDirection(1)).toBe("up");
  });
});

describe("decideWeightSurface", () => {
  it("hide mode returns { kind: 'hidden' } regardless of delta", () => {
    expect(decideWeightSurface("hide", null)).toEqual({ kind: "hidden" });
    expect(decideWeightSurface("hide", 1.5)).toEqual({ kind: "hidden" });
    expect(decideWeightSurface("hide", -0.2)).toEqual({ kind: "hidden" });
  });

  it("trends_only mode returns direction + friendly label, never absolute kg", () => {
    const up = decideWeightSurface("trends_only", 0.5);
    expect(up.kind).toBe("trends");
    if (up.kind === "trends") {
      expect(up.direction).toBe("up");
      expect(up.label).toBe("Trending up gently");
    }

    const down = decideWeightSurface("trends_only", -0.5);
    expect(down.kind).toBe("trends");
    if (down.kind === "trends") {
      expect(down.direction).toBe("down");
      expect(down.label).toBe("Trending down gently");
    }

    const stable = decideWeightSurface("trends_only", 0.1);
    expect(stable.kind).toBe("trends");
    if (stable.kind === "trends") {
      expect(stable.direction).toBe("stable");
      expect(stable.label).toBe("Holding steady");
    }

    const missing = decideWeightSurface("trends_only", null);
    expect(missing.kind).toBe("trends");
    if (missing.kind === "trends") {
      expect(missing.direction).toBeNull();
      expect(missing.label).toBe("Add a weigh-in to see your trend");
    }
  });

  it("trends_only mode never returns absolute kg text", () => {
    const values = [0, 0.05, 0.3, 1, 2.7, -0.5, -3.2];
    for (const v of values) {
      const d = decideWeightSurface("trends_only", v);
      expect(JSON.stringify(d)).not.toMatch(/kg/);
    }
  });

  it("show mode returns signed deltaText with 1 decimal and a kg suffix", () => {
    const pos = decideWeightSurface("show", 0.7);
    expect(pos.kind).toBe("show");
    if (pos.kind === "show") expect(pos.deltaText).toBe("+0.7 kg");

    const neg = decideWeightSurface("show", -0.5);
    expect(neg.kind).toBe("show");
    if (neg.kind === "show") expect(neg.deltaText).toBe("-0.5 kg");

    const zero = decideWeightSurface("show", 0);
    expect(zero.kind).toBe("show");
    if (zero.kind === "show") expect(zero.deltaText).toBe("0.0 kg");
  });

  it("show mode returns deltaText=null when delta is missing", () => {
    const d = decideWeightSurface("show", null);
    expect(d.kind).toBe("show");
    if (d.kind === "show") {
      expect(d.deltaKg).toBeNull();
      expect(d.deltaText).toBeNull();
    }
  });

  it("covers every valid WeightSurfaceMode enumeration", () => {
    const modes: WeightSurfaceMode[] = ["show", "hide", "trends_only"];
    for (const m of modes) {
      const d = decideWeightSurface(m, 0.1);
      expect(d.kind).toMatch(/^(show|hidden|trends)$/);
    }
  });
});

describe("formatLoggingConsistencyValue", () => {
  it("renders 0..7 / 7 for the Digest Weight-tile replacement", () => {
    expect(formatLoggingConsistencyValue(0)).toBe("0/7");
    expect(formatLoggingConsistencyValue(3)).toBe("3/7");
    expect(formatLoggingConsistencyValue(7)).toBe("7/7");
  });

  it("clamps negatives to 0 and values above 7 to 7", () => {
    expect(formatLoggingConsistencyValue(-2)).toBe("0/7");
    expect(formatLoggingConsistencyValue(99)).toBe("7/7");
  });

  it("rounds fractional inputs", () => {
    expect(formatLoggingConsistencyValue(3.4)).toBe("3/7");
    expect(formatLoggingConsistencyValue(3.6)).toBe("4/7");
  });

  it("handles NaN / non-finite inputs as 0", () => {
    expect(formatLoggingConsistencyValue(Number.NaN)).toBe("0/7");
    expect(formatLoggingConsistencyValue(Number.POSITIVE_INFINITY)).toBe("0/7");
  });
});
