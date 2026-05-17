import { describe, expect, it } from "vitest";
import {
  DEFAULT_SESSION_REPLAY_SAMPLE_RATE,
  SAMPLE_RATE_CACHE_KEY,
  SESSION_REPLAY_SAMPLE_RATE_FLAG,
  parseSampleRate,
  resolveSampleRate,
} from "../../src/lib/analytics/sessionReplaySampleRate";

/**
 * ENG-516 — Session-replay sample-rate flag plumbing. The pure logic
 * lives here so the same coercion + fallback rules apply on web
 * (localStorage strings) and mobile (AsyncStorage strings, PostHog
 * payload values). Tests pin the contract: any malformed input falls
 * back to 1.0, any in-range number wins, the cache key + flag key
 * stay stable.
 */

describe("sessionReplaySampleRate constants", () => {
  it("default rate is 1.0 (capture every session pre-launch)", () => {
    expect(DEFAULT_SESSION_REPLAY_SAMPLE_RATE).toBe(1.0);
  });

  it("cache key is stable so a rename doesn't orphan existing local storage", () => {
    expect(SAMPLE_RATE_CACHE_KEY).toBe(
      "suppr.posthog.session_replay_sample_rate",
    );
  });

  it("flag key matches the PostHog dashboard flag", () => {
    expect(SESSION_REPLAY_SAMPLE_RATE_FLAG).toBe("session-replay-sample-rate");
  });
});

describe("parseSampleRate", () => {
  it("accepts numbers in [0, 1]", () => {
    expect(parseSampleRate(1)).toBe(1);
    expect(parseSampleRate(0)).toBe(0);
    expect(parseSampleRate(0.1)).toBeCloseTo(0.1);
    expect(parseSampleRate(0.5)).toBe(0.5);
  });

  it("rejects numbers outside [0, 1]", () => {
    expect(parseSampleRate(-0.1)).toBeNull();
    expect(parseSampleRate(1.1)).toBeNull();
    expect(parseSampleRate(100)).toBeNull();
    expect(parseSampleRate(-1)).toBeNull();
  });

  it("rejects non-finite numbers", () => {
    expect(parseSampleRate(NaN)).toBeNull();
    expect(parseSampleRate(Infinity)).toBeNull();
    expect(parseSampleRate(-Infinity)).toBeNull();
  });

  it("accepts numeric strings", () => {
    expect(parseSampleRate("1")).toBe(1);
    expect(parseSampleRate("0")).toBe(0);
    expect(parseSampleRate("0.1")).toBeCloseTo(0.1);
    expect(parseSampleRate("1.0")).toBe(1);
    expect(parseSampleRate("  0.25  ")).toBe(0.25);
  });

  it("accepts JSON-stringified numbers (PostHog payload format)", () => {
    // PostHog returns JSON payloads as the raw JSON string. A 1.0
    // payload arrives as the literal string "1.0", which `parseFloat`
    // handles directly. A `{"sampleRate": 0.1}` payload would arrive
    // as that JSON string; we don't try to dig into structured shapes.
    expect(parseSampleRate("1.0")).toBe(1);
    expect(parseSampleRate("0.1")).toBeCloseTo(0.1);
  });

  it("rejects empty / whitespace-only strings", () => {
    expect(parseSampleRate("")).toBeNull();
    expect(parseSampleRate("   ")).toBeNull();
  });

  it("rejects non-numeric strings", () => {
    expect(parseSampleRate("abc")).toBeNull();
    expect(parseSampleRate("on")).toBeNull();
    expect(parseSampleRate("true")).toBeNull();
  });

  it("rejects strings whose parsed value is out of range", () => {
    expect(parseSampleRate("1.5")).toBeNull();
    expect(parseSampleRate("-0.5")).toBeNull();
  });

  it("rejects nullish values", () => {
    expect(parseSampleRate(null)).toBeNull();
    expect(parseSampleRate(undefined)).toBeNull();
  });

  it("rejects booleans and objects", () => {
    expect(parseSampleRate(true)).toBeNull();
    expect(parseSampleRate(false)).toBeNull();
    expect(parseSampleRate({})).toBeNull();
    expect(parseSampleRate([])).toBeNull();
    expect(parseSampleRate({ sampleRate: 0.5 })).toBeNull();
  });
});

describe("resolveSampleRate", () => {
  it("returns the default when input is null", () => {
    expect(resolveSampleRate(null)).toBe(DEFAULT_SESSION_REPLAY_SAMPLE_RATE);
  });

  it("returns the default when input is undefined", () => {
    expect(resolveSampleRate(undefined)).toBe(
      DEFAULT_SESSION_REPLAY_SAMPLE_RATE,
    );
  });

  it("returns the default when input is malformed", () => {
    expect(resolveSampleRate("not-a-number")).toBe(
      DEFAULT_SESSION_REPLAY_SAMPLE_RATE,
    );
    expect(resolveSampleRate("1.5")).toBe(DEFAULT_SESSION_REPLAY_SAMPLE_RATE);
    expect(resolveSampleRate({})).toBe(DEFAULT_SESSION_REPLAY_SAMPLE_RATE);
  });

  it("returns the parsed value when input is valid", () => {
    expect(resolveSampleRate("0.1")).toBeCloseTo(0.1);
    expect(resolveSampleRate("0")).toBe(0);
    expect(resolveSampleRate("1")).toBe(1);
    expect(resolveSampleRate(0.25)).toBe(0.25);
  });

  it("falls back rather than throw on edge inputs", () => {
    expect(() => resolveSampleRate(Symbol("x"))).not.toThrow();
    expect(resolveSampleRate(Symbol("x"))).toBe(
      DEFAULT_SESSION_REPLAY_SAMPLE_RATE,
    );
  });
});
