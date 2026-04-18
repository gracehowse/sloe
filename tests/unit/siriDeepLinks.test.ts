/**
 * Batch 5.12 — shared Siri deep-link parser.
 *
 * Exercised from the root runner too so the web TS build picks up any
 * breakage in the shared helper. The mobile suite adds additional
 * malformed-input coverage.
 */
import { describe, it, expect } from "vitest";
import {
  parseSiriDeepLink,
  buildLogWaterUrl,
  buildStartFastUrl,
  TODAY_REMAINING_URL,
} from "../../src/lib/nutrition/siriDeepLinks";

describe("parseSiriDeepLink (shared)", () => {
  it("parses log water with explicit volume", () => {
    expect(parseSiriDeepLink("suppr://log/water?ml=250")).toEqual({ kind: "log_water", ml: 250 });
  });

  it("parses start fast with default hours", () => {
    expect(parseSiriDeepLink("suppr://fast/start")).toEqual({ kind: "start_fast", hours: 16 });
  });

  it("parses today remaining", () => {
    expect(parseSiriDeepLink("suppr://today/remaining")).toEqual({ kind: "today_remaining" });
  });

  it("rejects non-suppr scheme", () => {
    expect(parseSiriDeepLink("https://suppr.app/log/water?ml=250")).toBeNull();
  });

  it("rejects malformed input without throwing", () => {
    expect(parseSiriDeepLink("not a url")).toBeNull();
    expect(parseSiriDeepLink("")).toBeNull();
    expect(parseSiriDeepLink(null as unknown as string)).toBeNull();
  });

  it("builders produce URLs that round-trip", () => {
    expect(parseSiriDeepLink(buildLogWaterUrl(500))).toEqual({ kind: "log_water", ml: 500 });
    expect(parseSiriDeepLink(buildStartFastUrl(18))).toEqual({ kind: "start_fast", hours: 18 });
    expect(parseSiriDeepLink(TODAY_REMAINING_URL)).toEqual({ kind: "today_remaining" });
  });
});
