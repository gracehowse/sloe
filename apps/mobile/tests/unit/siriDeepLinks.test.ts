/**
 * Batch 5.12 — Siri-shortcut deep-link parser tests.
 *
 * Covers all three recognised actions, defaults, clamping, and a broad
 * range of malformed / hostile inputs that must never crash and must
 * never route an ambiguous URL to a real action.
 */
import { describe, it, expect } from "vitest";
import {
  parseSiriDeepLink,
  buildLogWaterUrl,
  buildStartFastUrl,
  TODAY_REMAINING_URL,
  SIRI_DEFAULT_WATER_ML,
  SIRI_DEFAULT_FAST_HOURS,
} from "../../../../src/lib/nutrition/siriDeepLinks";

describe("parseSiriDeepLink — log water", () => {
  it("parses the canonical URL", () => {
    expect(parseSiriDeepLink("suppr://log/water?ml=250")).toEqual({
      kind: "log_water",
      ml: 250,
    });
  });

  it("defaults ml to 250 when the parameter is absent", () => {
    expect(parseSiriDeepLink("suppr://log/water")).toEqual({
      kind: "log_water",
      ml: SIRI_DEFAULT_WATER_ML,
    });
  });

  it("defaults ml to 250 when the parameter is empty string", () => {
    expect(parseSiriDeepLink("suppr://log/water?ml=")).toEqual({
      kind: "log_water",
      ml: 250,
    });
  });

  it("rounds fractional ml values", () => {
    expect(parseSiriDeepLink("suppr://log/water?ml=249.6")).toEqual({
      kind: "log_water",
      ml: 250,
    });
  });

  it("clamps obviously huge values to a defensible maximum", () => {
    expect(parseSiriDeepLink("suppr://log/water?ml=999999")).toEqual({
      kind: "log_water",
      ml: 5000,
    });
  });

  it("rejects zero / negative ml (nothing to log)", () => {
    expect(parseSiriDeepLink("suppr://log/water?ml=0")).toBeNull();
    expect(parseSiriDeepLink("suppr://log/water?ml=-10")).toBeNull();
  });

  it("rejects non-numeric ml", () => {
    expect(parseSiriDeepLink("suppr://log/water?ml=abc")).toBeNull();
    expect(parseSiriDeepLink("suppr://log/water?ml=NaN")).toBeNull();
  });
});

describe("parseSiriDeepLink — start fast", () => {
  it("parses the canonical URL", () => {
    expect(parseSiriDeepLink("suppr://fast/start?hours=16")).toEqual({
      kind: "start_fast",
      hours: 16,
    });
  });

  it("defaults hours to 16 when the parameter is absent", () => {
    expect(parseSiriDeepLink("suppr://fast/start")).toEqual({
      kind: "start_fast",
      hours: SIRI_DEFAULT_FAST_HOURS,
    });
  });

  it("honours an explicit non-default like 18h", () => {
    expect(parseSiriDeepLink("suppr://fast/start?hours=18")).toEqual({
      kind: "start_fast",
      hours: 18,
    });
  });

  it("clamps to a defensible maximum (48h)", () => {
    expect(parseSiriDeepLink("suppr://fast/start?hours=500")).toEqual({
      kind: "start_fast",
      hours: 48,
    });
  });

  it("rejects zero / negative hours", () => {
    expect(parseSiriDeepLink("suppr://fast/start?hours=0")).toBeNull();
    expect(parseSiriDeepLink("suppr://fast/start?hours=-1")).toBeNull();
  });
});

describe("parseSiriDeepLink — today remaining", () => {
  it("parses the canonical URL", () => {
    expect(parseSiriDeepLink("suppr://today/remaining")).toEqual({
      kind: "today_remaining",
    });
  });

  it("ignores trailing slashes", () => {
    expect(parseSiriDeepLink("suppr://today/remaining/")).toEqual({
      kind: "today_remaining",
    });
  });

  it("is case-insensitive on host + path", () => {
    expect(parseSiriDeepLink("SUPPR://Today/Remaining")).toEqual({
      kind: "today_remaining",
    });
  });
});

describe("parseSiriDeepLink — malformed input", () => {
  it.each([
    ["", "empty string"],
    ["not a url", "garbage"],
    ["suppr://", "scheme only"],
    ["suppr://log", "no path"],
    ["suppr://log/water/extra/segments", "unknown path"],
    ["suppr://fast/stop", "unknown fast action"],
    ["suppr://today/dinner", "unknown today action"],
    ["https://suppr.app/log/water?ml=250", "wrong scheme"],
    ["other://log/water?ml=250", "wrong scheme"],
  ])("rejects %s (%s)", (input) => {
    expect(parseSiriDeepLink(input)).toBeNull();
  });

  it.each([
    null,
    undefined,
    42,
    {},
    [],
    true,
  ])("rejects non-string input %p", (input) => {
    expect(parseSiriDeepLink(input as unknown as string)).toBeNull();
  });
});

describe("buildLogWaterUrl / buildStartFastUrl / TODAY_REMAINING_URL", () => {
  it("round-trips through parseSiriDeepLink with defaults", () => {
    expect(parseSiriDeepLink(buildLogWaterUrl())).toEqual({ kind: "log_water", ml: 250 });
    expect(parseSiriDeepLink(buildStartFastUrl())).toEqual({ kind: "start_fast", hours: 16 });
    expect(parseSiriDeepLink(TODAY_REMAINING_URL)).toEqual({ kind: "today_remaining" });
  });

  it("round-trips through parseSiriDeepLink with custom args", () => {
    expect(parseSiriDeepLink(buildLogWaterUrl(500))).toEqual({ kind: "log_water", ml: 500 });
    expect(parseSiriDeepLink(buildStartFastUrl(18))).toEqual({ kind: "start_fast", hours: 18 });
  });

  it("clamps inputs in builders so we never emit nonsense URLs", () => {
    expect(buildLogWaterUrl(-10)).toBe("suppr://log/water?ml=1");
    expect(buildLogWaterUrl(999999)).toBe("suppr://log/water?ml=5000");
    expect(buildStartFastUrl(0)).toBe("suppr://fast/start?hours=1");
    expect(buildStartFastUrl(500)).toBe("suppr://fast/start?hours=48");
  });
});
