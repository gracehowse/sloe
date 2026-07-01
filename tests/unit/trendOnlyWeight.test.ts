/**
 * ENG-713 — "Trend-only weight" body-neutral display pref (ED + dysphoria
 * dignity). Pins the client-side pref primitives + the neutral trend-copy
 * helper: the copy must never leak a number, a unit, or valence, and the pref
 * must default OFF (opt-in) with a shared storage key across web + mobile.
 *
 * The strings here are dignity-sensitive — they need diversity-inclusion +
 * legal-reviewer sign-off before ramp (see the decision doc). This test locks
 * the CONTRACT (no numbers / no valence / neutral steady / inviting empty) so a
 * later copy edit can't silently regress the safety properties.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TREND_ONLY_WEIGHT,
  TREND_ONLY_MODE_NOTE,
  TREND_ONLY_STABLE_KG,
  TREND_ONLY_WEIGHT_STORAGE_KEY,
  describeTrendOnly,
  resolveTrendOnlyWeight,
  trendOnlyDirection,
} from "../../src/lib/preferences/trendOnlyWeight";

describe("trend-only weight pref primitives", () => {
  it("defaults OFF — the feature is opt-in (no behaviour change until flipped)", () => {
    expect(DEFAULT_TREND_ONLY_WEIGHT).toBe(false);
    expect(resolveTrendOnlyWeight(null)).toBe(false);
    expect(resolveTrendOnlyWeight(undefined)).toBe(false);
    expect(resolveTrendOnlyWeight("")).toBe(false);
    expect(resolveTrendOnlyWeight("garbage")).toBe(false);
  });

  it("reads the stringified boolean from storage", () => {
    expect(resolveTrendOnlyWeight("true")).toBe(true);
    expect(resolveTrendOnlyWeight("false")).toBe(false);
  });

  it("accepts a native boolean (forward-compatible with a synced value)", () => {
    expect(resolveTrendOnlyWeight(true)).toBe(true);
    expect(resolveTrendOnlyWeight(false)).toBe(false);
  });

  it("uses one storage key across web + mobile", () => {
    expect(TREND_ONLY_WEIGHT_STORAGE_KEY).toBe("suppr.prefs.trend_only_weight");
  });
});

describe("trendOnlyDirection", () => {
  it("returns null when the delta is missing or non-finite (no invented steady)", () => {
    expect(trendOnlyDirection(null)).toBeNull();
    expect(trendOnlyDirection(undefined)).toBeNull();
    expect(trendOnlyDirection(Number.NaN)).toBeNull();
    expect(trendOnlyDirection(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("reads 'steady' inside the stable band", () => {
    expect(trendOnlyDirection(0)).toBe("steady");
    expect(trendOnlyDirection(0.1)).toBe("steady");
    expect(trendOnlyDirection(-0.29)).toBe("steady");
  });

  it("reads 'down' / 'up' at or above the stable threshold", () => {
    expect(trendOnlyDirection(-TREND_ONLY_STABLE_KG)).toBe("down");
    expect(trendOnlyDirection(-1.2)).toBe("down");
    expect(trendOnlyDirection(TREND_ONLY_STABLE_KG)).toBe("up");
    expect(trendOnlyDirection(2)).toBe("up");
  });

  it("shares the 0.3 kg stable band with the T13 policy + Digest headline", () => {
    expect(TREND_ONLY_STABLE_KG).toBe(0.3);
  });
});

describe("describeTrendOnly — body-neutral copy contract", () => {
  it("states direction gently, never as an achievement", () => {
    expect(describeTrendOnly("down")).toBe("Trending down gently");
    expect(describeTrendOnly("up")).toBe("Trending up gently");
    expect(describeTrendOnly("steady")).toBe("Holding steady");
  });

  it("invites (does not instruct) when there is no weigh-in", () => {
    const empty = describeTrendOnly(null);
    expect(empty).toBe("Add a weigh-in to see your trend");
    // no imperative "start" / "you must", no shame
    expect(empty.toLowerCase()).not.toMatch(/must|should|start now|need to/);
  });

  it("NEVER contains a number, a unit, or a goal-gap figure", () => {
    const all = [
      describeTrendOnly("down"),
      describeTrendOnly("up"),
      describeTrendOnly("steady"),
      describeTrendOnly(null),
      TREND_ONLY_MODE_NOTE,
    ];
    for (const s of all) {
      expect(s, `"${s}" must have no digits`).not.toMatch(/\d/);
      expect(s, `"${s}" must have no kg/lb unit`).not.toMatch(/\b(kg|lb|lbs|kilograms?|pounds?)\b/i);
      expect(s, `"${s}" must not name a scale`).not.toMatch(/\bscale\b/i);
    }
  });

  it("carries NO good/bad valence on the direction words", () => {
    const all = [describeTrendOnly("down"), describeTrendOnly("up"), describeTrendOnly("steady")];
    for (const s of all) {
      expect(s.toLowerCase()).not.toMatch(
        /great|good|bad|nice|well done|progress|on track|keep it up|amazing|congrat/,
      );
    }
    // Up and down are described symmetrically — neither is framed as better.
    expect(describeTrendOnly("up").replace("up", "X")).toBe(
      describeTrendOnly("down").replace("down", "X"),
    );
  });

  it("mode note points at the exit so the mode never feels like a trap", () => {
    expect(TREND_ONLY_MODE_NOTE).toMatch(/Settings/);
    expect(TREND_ONLY_MODE_NOTE.toLowerCase()).toMatch(/turn numbers back on/);
  });
});
