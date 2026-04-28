/**
 * trackingExtras — pins the parse / serialise / gate logic for the
 * caffeine + alcohol opt-in (Phase 2 / B1.4, D-2026-04-27-08).
 */

import { describe, it, expect } from "vitest";

import {
  DEFAULT_TRACKING_EXTRAS,
  TRACKING_EXTRAS_STORAGE_KEY,
  parseTrackingExtras,
  serializeTrackingExtras,
  shouldRenderHydrationCard,
} from "../../src/lib/nutrition/trackingExtras";

describe("trackingExtras — defaults", () => {
  it("defaults both toggles to off", () => {
    expect(DEFAULT_TRACKING_EXTRAS.trackCaffeine).toBe(false);
    expect(DEFAULT_TRACKING_EXTRAS.trackAlcohol).toBe(false);
  });

  it("uses a stable storage key shared across web + mobile", () => {
    expect(TRACKING_EXTRAS_STORAGE_KEY).toBe("suppr.tracking-extras.v1");
  });
});

describe("parseTrackingExtras", () => {
  it("returns defaults for null / empty / non-string input", () => {
    expect(parseTrackingExtras(null)).toEqual(DEFAULT_TRACKING_EXTRAS);
    expect(parseTrackingExtras(undefined)).toEqual(DEFAULT_TRACKING_EXTRAS);
    expect(parseTrackingExtras("")).toEqual(DEFAULT_TRACKING_EXTRAS);
  });

  it("returns defaults for malformed JSON without throwing", () => {
    expect(parseTrackingExtras("not json {{")).toEqual(DEFAULT_TRACKING_EXTRAS);
  });

  it("returns defaults for non-object JSON", () => {
    expect(parseTrackingExtras(JSON.stringify(42))).toEqual(DEFAULT_TRACKING_EXTRAS);
    expect(parseTrackingExtras(JSON.stringify(["a"]))).toEqual(DEFAULT_TRACKING_EXTRAS);
  });

  it("parses both toggles when present", () => {
    const raw = JSON.stringify({ trackCaffeine: true, trackAlcohol: true });
    expect(parseTrackingExtras(raw)).toEqual({ trackCaffeine: true, trackAlcohol: true });
  });

  it("falls back per-key when a single key is missing or wrong-typed", () => {
    expect(parseTrackingExtras(JSON.stringify({ trackCaffeine: true }))).toEqual({
      trackCaffeine: true,
      trackAlcohol: false,
    });
    expect(parseTrackingExtras(JSON.stringify({ trackCaffeine: "yes" }))).toEqual({
      trackCaffeine: false,
      trackAlcohol: false,
    });
  });
});

describe("serializeTrackingExtras", () => {
  it("emits canonical-shape JSON regardless of extra fields on the input", () => {
    const out = serializeTrackingExtras({
      trackCaffeine: true,
      trackAlcohol: false,
      // @ts-expect-error — exercise extra-field tolerance
      trackSodium: true,
    });
    expect(JSON.parse(out)).toEqual({ trackCaffeine: true, trackAlcohol: false });
  });

  it("round-trips with parseTrackingExtras", () => {
    const a = { trackCaffeine: true, trackAlcohol: true };
    expect(parseTrackingExtras(serializeTrackingExtras(a))).toEqual(a);

    const b = { trackCaffeine: false, trackAlcohol: true };
    expect(parseTrackingExtras(serializeTrackingExtras(b))).toEqual(b);
  });
});

describe("shouldRenderHydrationCard — opt-in gate", () => {
  it("renders when the underlying hydration sub-rule passes (water target / water logs)", () => {
    expect(
      shouldRenderHydrationCard({
        hydrationGateOpen: true,
        trackCaffeine: false,
        trackAlcohol: false,
        hasCaffeineLogs: false,
        hasAlcoholLogs: false,
      }),
    ).toBe(true);
  });

  it("does NOT render on caffeine logs alone when caffeine opt-in is off", () => {
    expect(
      shouldRenderHydrationCard({
        hydrationGateOpen: false,
        trackCaffeine: false,
        trackAlcohol: false,
        hasCaffeineLogs: true,
        hasAlcoholLogs: false,
      }),
    ).toBe(false);
  });

  it("renders on caffeine logs once caffeine opt-in flips on", () => {
    expect(
      shouldRenderHydrationCard({
        hydrationGateOpen: false,
        trackCaffeine: true,
        trackAlcohol: false,
        hasCaffeineLogs: true,
        hasAlcoholLogs: false,
      }),
    ).toBe(true);
  });

  it("renders on alcohol logs once alcohol opt-in flips on", () => {
    expect(
      shouldRenderHydrationCard({
        hydrationGateOpen: false,
        trackCaffeine: false,
        trackAlcohol: true,
        hasCaffeineLogs: false,
        hasAlcoholLogs: true,
      }),
    ).toBe(true);
  });

  it("does not render when both opt-ins are off and hydration is closed (default first-run)", () => {
    expect(
      shouldRenderHydrationCard({
        hydrationGateOpen: false,
        trackCaffeine: false,
        trackAlcohol: false,
        hasCaffeineLogs: false,
        hasAlcoholLogs: false,
      }),
    ).toBe(false);
  });

  it("opt-in toggle off + cached caffeine logs → row hidden (existing data preserved)", () => {
    // The intent of the gate: turning the toggle off must not surface
    // historical data. The row in HydrationStimulantsCard is a
    // separate concern (gates on `targets.caffeineMg === 0`); this
    // helper just covers the card-level visibility.
    expect(
      shouldRenderHydrationCard({
        hydrationGateOpen: false,
        trackCaffeine: false,
        trackAlcohol: false,
        hasCaffeineLogs: true,
        hasAlcoholLogs: true,
      }),
    ).toBe(false);
  });
});
