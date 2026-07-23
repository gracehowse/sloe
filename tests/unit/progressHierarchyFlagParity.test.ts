/**
 * ENG-1525 — `progress_hierarchy_v1` registration parity (web ↔ mobile).
 *
 * Flipped DEFAULT-ON 2026-07-23 (prototype gap audit flag-collapse). Must be
 * in BOTH platforms' `REDESIGN_DEFAULT_ON` and absent from active
 * `KNOWN_DEFAULT_OFF_FLAGS` entries. Off-path else branches remain the kill switch.
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
  for (const m of body.matchAll(/"([a-z0-9_-]+)"/g)) flags.add(m[1]);
  return flags;
}

const parseDefaultOn = (src: string) =>
  parseBlock(src, "REDESIGN_DEFAULT_ON = new Set<string>([", "]);");
const parseDefaultOff = (src: string) =>
  parseBlock(src, "KNOWN_DEFAULT_OFF_FLAGS = [", "] as const;");

describe("progress_hierarchy_v1 flag registration (ENG-1525, default-ON)", () => {
  const webOn = parseDefaultOn(WEB_TRACK);
  const mobileOn = parseDefaultOn(MOBILE_ANALYTICS);
  const webOff = parseDefaultOff(WEB_TRACK);
  const mobileOff = parseDefaultOff(MOBILE_ANALYTICS);

  it("is registered DEFAULT-ON on BOTH platforms", () => {
    expect(webOn.has("progress_hierarchy_v1"), "web REDESIGN_DEFAULT_ON").toBe(true);
    expect(mobileOn.has("progress_hierarchy_v1"), "mobile REDESIGN_DEFAULT_ON").toBe(true);
  });

  it("is NOT in either active KNOWN_DEFAULT_OFF_FLAGS set", () => {
    expect(webOff.has("progress_hierarchy_v1"), "web KNOWN_DEFAULT_OFF_FLAGS").toBe(false);
    expect(mobileOff.has("progress_hierarchy_v1"), "mobile KNOWN_DEFAULT_OFF_FLAGS").toBe(false);
  });

  it("the two default-OFF lists remain identical", () => {
    expect([...webOff].sort()).toEqual([...mobileOff].sort());
  });
});
