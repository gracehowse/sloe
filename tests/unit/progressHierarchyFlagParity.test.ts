/**
 * ENG-1525 — `progress_hierarchy_v1` registration parity (web ↔ mobile).
 *
 * The Progress 5-section hierarchy shipped DEFAULT-OFF (the energy_numbers_v1
 * precedent: a full-tab structural rebuild ramps behind a dark flag with
 * before/after screenshots, not the "always flag on" additive-card
 * convention). It is gated by membership in `KNOWN_DEFAULT_OFF_FLAGS`, which
 * must be present on BOTH `src/lib/analytics/track.ts` and
 * `apps/mobile/lib/analytics.ts` — a flag registered on one side only would
 * ramp one platform and leave the other dark (mirror of the ENG-953
 * `expenditureTrendFlagParity` guard). It must NOT also appear in either
 * `REDESIGN_DEFAULT_ON` set — a flag belongs to exactly one default set,
 * and default-ON here would flip the whole Progress tab with no PostHog row.
 * The legacy 13-card stack in each host's `else` branch is the kill switch.
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

/** Collect `"flag"` tokens from the block between `marker` and the first `close`. */
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

describe("progress_hierarchy_v1 flag registration (ENG-1525, default-OFF)", () => {
  const webOn = parseDefaultOn(WEB_TRACK);
  const mobileOn = parseDefaultOn(MOBILE_ANALYTICS);
  const webOff = parseDefaultOff(WEB_TRACK);
  const mobileOff = parseDefaultOff(MOBILE_ANALYTICS);

  it("is registered DEFAULT-OFF on BOTH platforms", () => {
    expect(webOff.has("progress_hierarchy_v1"), "web KNOWN_DEFAULT_OFF_FLAGS").toBe(true);
    expect(
      mobileOff.has("progress_hierarchy_v1"),
      "mobile KNOWN_DEFAULT_OFF_FLAGS",
    ).toBe(true);
  });

  it("is NOT also in either REDESIGN_DEFAULT_ON set", () => {
    expect(webOn.has("progress_hierarchy_v1"), "web REDESIGN_DEFAULT_ON").toBe(false);
    expect(mobileOn.has("progress_hierarchy_v1"), "mobile REDESIGN_DEFAULT_ON").toBe(
      false,
    );
  });

  it("the two default-OFF lists remain identical", () => {
    expect([...webOff].sort()).toEqual([...mobileOff].sort());
  });
});
