/**
 * ENG-1634 — `smart_suggestions_v1` registration parity (web ↔ mobile).
 *
 * Shopping-list Smart suggestions is a new visual section → ships DEFAULT-OFF
 * behind PostHog. Both platforms must register the same default-OFF membership
 * so a ramp can't light one surface and leave the other dark.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const WEB_TRACK = readFileSync(resolve(ROOT, "src/lib/analytics/track.ts"), "utf8");
const MOBILE_ANALYTICS = readFileSync(
  resolve(ROOT, "apps/mobile/lib/analytics.ts"),
  "utf8",
);

function parseBlock(src: string, marker: string, close: string): Set<string> {
  const start = src.indexOf(marker);
  expect(start, `${marker} block`).toBeGreaterThanOrEqual(0);
  const end = src.indexOf(close, start);
  expect(end, `${marker} close`).toBeGreaterThan(start);
  const body = src.slice(start + marker.length, end);
  const flags = new Set<string>();
  for (const m of body.matchAll(/"([a-z0-9_-]+)"/g)) flags.add(m[1]!);
  return flags;
}

const FLAG = "smart_suggestions_v1";
const parseDefaultOn = (src: string) =>
  parseBlock(src, "REDESIGN_DEFAULT_ON = new Set<string>([", "]);");
const parseDefaultOff = (src: string) =>
  parseBlock(src, "KNOWN_DEFAULT_OFF_FLAGS = [", "] as const;");

describe("smart_suggestions_v1 flag registration (ENG-1634, default-OFF)", () => {
  const webOn = parseDefaultOn(WEB_TRACK);
  const mobileOn = parseDefaultOn(MOBILE_ANALYTICS);
  const webOff = parseDefaultOff(WEB_TRACK);
  const mobileOff = parseDefaultOff(MOBILE_ANALYTICS);

  it("is registered DEFAULT-OFF on BOTH platforms", () => {
    expect(webOff.has(FLAG), "web KNOWN_DEFAULT_OFF_FLAGS").toBe(true);
    expect(mobileOff.has(FLAG), "mobile KNOWN_DEFAULT_OFF_FLAGS").toBe(true);
  });

  it("is NOT also in either REDESIGN_DEFAULT_ON set", () => {
    expect(webOn.has(FLAG), "web REDESIGN_DEFAULT_ON").toBe(false);
    expect(mobileOn.has(FLAG), "mobile REDESIGN_DEFAULT_ON").toBe(false);
  });
});
