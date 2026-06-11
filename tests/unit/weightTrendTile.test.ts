/**
 * Action 13 Item #2 (2026-04-19) — Trend tile shared helper.
 *
 * Pinning the on-track logic + the shape of the returned `{delta, copy}`
 * pair so the web Trend tile (and any future mobile adoption) can't
 * regress to the old "two IIFEs that compute the delta differently"
 * pattern, where a "gain" user with no logged weight got "on track"
 * because `Infinity > 0`.
 */
import { describe, expect, it } from "vitest";

import { computeWeightTrendCopy } from "../../src/lib/nutrition/weightTrendTile";

const WEEK_AGO = "2026-04-12";
const TODAY = "2026-04-19";

function makeMap(entries: Array<[string, number]>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of entries) out[k] = v;
  return out;
}

const NOW = new Date("2026-04-19T12:00:00Z");

describe("computeWeightTrendCopy", () => {
  it("returns a null delta + 'Log weight to see trend' when no weigh-ins", () => {
    const r = computeWeightTrendCopy({
      weightKgByDay: {},
      weightKg: 80,
      goalKg: 75,
      now: NOW,
    });
    expect(r.delta).toBeNull();
    expect(r.copy).toBe("Log weight to see trend");
  });

  it("returns a null delta + 'Log weight to see trend' when only one weigh-in", () => {
    const r = computeWeightTrendCopy({
      weightKgByDay: makeMap([[TODAY, 80]]),
      weightKg: 80,
      goalKg: 75,
      now: NOW,
    });
    expect(r.delta).toBeNull();
    expect(r.copy).toBe("Log weight to see trend");
  });

  it("F-56: suppresses delta when most recent weigh-in is older than 14 days", () => {
    // TestFlight build-28 feedback AOVuCyOCNB1p — tester saw
    // "Up 0.9 this week" when they had not logged a weight in ~1 month.
    // The two historical entries produced a real delta but mislabelled
    // it "this week". Stale-data guard returns the null-delta copy.
    const r = computeWeightTrendCopy({
      weightKgByDay: makeMap([
        ["2026-03-01", 79.0],
        ["2026-03-15", 79.9],
      ]),
      weightKg: 79.9,
      goalKg: 75,
      now: NOW, // 2026-04-19
    });
    expect(r.delta).toBeNull();
    expect(r.copy).toBe("Log weight to see trend");
  });

  it("(a) cut user losing weight is on track", () => {
    const r = computeWeightTrendCopy({
      weightKgByDay: makeMap([
        [WEEK_AGO, 80.4],
        [TODAY, 79.9],
      ]),
      weightKg: 79.9,
      goalKg: 75,
      now: NOW,
    });
    expect(r.delta).toBe(-0.5);
    expect(r.copy).toBe("on track");
  });

  it("(b) cut user gaining weight is off track", () => {
    const r = computeWeightTrendCopy({
      weightKgByDay: makeMap([
        [WEEK_AGO, 80.0],
        [TODAY, 80.6],
      ]),
      weightKg: 80.6,
      goalKg: 75,
      now: NOW,
    });
    expect(r.delta).toBe(0.6);
    expect(r.copy).toBe("this week");
  });

  it("(c) gain user gaining is on track", () => {
    const r = computeWeightTrendCopy({
      weightKgByDay: makeMap([
        [WEEK_AGO, 70.0],
        [TODAY, 70.4],
      ]),
      weightKg: 70.4,
      goalKg: 75,
      now: NOW,
    });
    expect(r.delta).toBe(0.4);
    expect(r.copy).toBe("on track");
  });

  it("(d) gain user losing is off track", () => {
    const r = computeWeightTrendCopy({
      weightKgByDay: makeMap([
        [WEEK_AGO, 70.0],
        [TODAY, 69.6],
      ]),
      weightKg: 69.6,
      goalKg: 75,
      now: NOW,
    });
    expect(r.delta).toBe(-0.4);
    expect(r.copy).toBe("this week");
  });

  it("(e) maintenance: small swing within ±0.5 kg counts as on track", () => {
    const r = computeWeightTrendCopy({
      weightKgByDay: makeMap([
        [WEEK_AGO, 75.0],
        [TODAY, 75.3],
      ]),
      weightKg: 75.0,
      goalKg: 75.0,
      now: NOW,
    });
    expect(r.delta).toBe(0.3);
    expect(r.copy).toBe("on track");
  });

  it("(e2) maintenance: ±1 kg swing is off track", () => {
    const r = computeWeightTrendCopy({
      weightKgByDay: makeMap([
        [WEEK_AGO, 75.0],
        [TODAY, 76.1],
      ]),
      weightKg: 75.0,
      goalKg: 75.0,
      now: NOW,
    });
    expect(r.copy).toBe("this week");
  });

  it("(f) weightKg null but ≥2 weigh-ins → still computes delta and falls to 'no goal set'", () => {
    // The bug: previously `weightKg ?? Infinity` meant a "gain" user
    // with `weightKg = null` was trivially on track because the
    // `goalKg > Infinity` check evaluated as false but the inverse
    // `goalKg < Infinity` evaluated as true. Now we don't coerce at
    // all — when we can't resolve the direction, we surface a neutral
    // "no goal set" copy and return the real delta from the map.
    const r = computeWeightTrendCopy({
      weightKgByDay: makeMap([
        [WEEK_AGO, 80.0],
        [TODAY, 80.5],
      ]),
      weightKg: null,
      goalKg: 75,
      now: NOW,
    });
    expect(r.delta).toBe(0.5);
    // Direction can be inferred from weightKgByDay alone? No — we only
    // resolve direction from `weightKg` vs `goalKg`. Without `weightKg`
    // we don't know which way the user wants to go. Helper surfaces
    // "no goal set" as the neutral copy in that case.
    expect(r.copy).toBe("no goal set");
  });

  it("(g) goalKg null → computes delta but copy is 'no goal set'", () => {
    const r = computeWeightTrendCopy({
      weightKgByDay: makeMap([
        [WEEK_AGO, 80.0],
        [TODAY, 79.5],
      ]),
      weightKg: 80,
      goalKg: null,
      now: NOW,
    });
    expect(r.delta).toBe(-0.5);
    expect(r.copy).toBe("no goal set");
  });

  it("uses the oldest entry as the comparison when none is ≥7 days old", () => {
    // Two entries, both within the last 7 days. Helper falls back to
    // the oldest available rather than fabricating a 7-day window.
    const r = computeWeightTrendCopy({
      weightKgByDay: makeMap([
        ["2026-04-17", 80.6],
        ["2026-04-19", 80.0],
      ]),
      weightKg: 80,
      goalKg: 75,
      now: NOW,
    });
    expect(r.delta).toBe(-0.6);
    expect(r.copy).toBe("on track");
  });

  // ─── ENG-1026: on-track copy judges the SMOOTHED trend, not raw scale ───
  describe("ENG-1026 water-blip resilience", () => {
    it("one +1 kg water spike on the latest reading does NOT flip a losing user off track", () => {
      // A clearly-losing user (80.0 → 79.4 over the week) whose most
      // recent reading jumps +1 kg on water (a salty dinner / hard
      // session). The RAW recent-vs-week-ago delta is positive (+0.4),
      // which the old logic read as "off track". The smoothed trend is
      // still firmly downward, so the verdict stays "on track" — the blip
      // can't dominate.
      const r = computeWeightTrendCopy({
        weightKgByDay: makeMap([
          ["2026-04-12", 80.0],
          ["2026-04-14", 79.8],
          ["2026-04-16", 79.6],
          ["2026-04-18", 79.4],
          ["2026-04-19", 80.4], // water blip on the latest reading
        ]),
        weightKg: 80.4,
        goalKg: 75,
        now: NOW,
      });
      // Headline delta is still the raw figure the user sees on the scale.
      expect(r.delta).toBe(0.4);
      // …but the verdict is judged on the (downward) trend.
      expect(r.copy).toBe("on track");
    });

    it("one +1 kg water spike does NOT flip a maintenance user off track", () => {
      // Daily weigh-ins flat around 75 kg with a single +1 kg spike on the
      // last day (a real water blip). Spread across a full week of flat
      // readings, the spike's leverage on the smoothed trend is small, so
      // the trend stays inside the maintenance ±0.5 kg band and the copy
      // holds at "on track" despite the raw +1.0 kg recent delta the old
      // two-point logic would have flipped.
      const r = computeWeightTrendCopy({
        weightKgByDay: makeMap([
          ["2026-04-13", 75.0],
          ["2026-04-14", 74.9],
          ["2026-04-15", 75.1],
          ["2026-04-16", 75.0],
          ["2026-04-17", 74.9],
          ["2026-04-18", 75.1],
          ["2026-04-19", 76.0], // water blip on the latest reading
        ]),
        weightKg: 75.0,
        goalKg: 75.0,
        now: NOW,
      });
      expect(r.delta).toBe(1.0);
      expect(r.copy).toBe("on track");
    });

    it("a genuine upward trend (not a blip) still reads off track for a losing user", () => {
      // Sanity: smoothing must not mask a real gain. Every reading climbs.
      const r = computeWeightTrendCopy({
        weightKgByDay: makeMap([
          ["2026-04-12", 79.4],
          ["2026-04-14", 79.6],
          ["2026-04-16", 79.8],
          ["2026-04-18", 80.0],
          ["2026-04-19", 80.2],
        ]),
        weightKg: 80.2,
        goalKg: 75,
        now: NOW,
      });
      expect(r.copy).toBe("this week");
    });
  });

  it("explicit direction overrides goal-derived direction", () => {
    // User on a "gain" plan with goal 75 → derived direction = "lose"
    // (current 80 > goal 75). Overriding to "gain" flips on-track.
    const r = computeWeightTrendCopy({
      weightKgByDay: makeMap([
        [WEEK_AGO, 80.0],
        [TODAY, 80.4],
      ]),
      weightKg: 80,
      goalKg: 75,
      direction: "gain",
      now: NOW,
    });
    expect(r.delta).toBe(0.4);
    expect(r.copy).toBe("on track");
  });
});
