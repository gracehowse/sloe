/**
 * ENG-1279 "always flag on" — the beta-window growth flags flipped DEFAULT-ON
 * (2026-06-30, Grace): `weigh_in_reminder_v1` (ENG-955), `portion_fit_hint_v1`
 * (ENG-854), `progress_plateau_insight_v1` (ENG-954). Each must be registered
 * in `REDESIGN_DEFAULT_ON` on BOTH `src/lib/analytics/track.ts` and
 * `apps/mobile/lib/analytics.ts` — a flag on one side only would render on one
 * platform and stay dark on the other. None may also appear in
 * `KNOWN_DEFAULT_OFF_FLAGS` (a flag belongs to exactly one default set), and
 * the two default-OFF lists must stay identical (web ↔ mobile SSOT parity).
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
  const flags = new Set<string>();
  for (const m of src.slice(start + marker.length, end).matchAll(/"([a-z0-9_-]+)"/g)) {
    flags.add(m[1]);
  }
  return flags;
}

const parseOn = (src: string) =>
  parseBlock(src, "REDESIGN_DEFAULT_ON = new Set<string>([", "]);");
const parseOff = (src: string) =>
  parseBlock(src, "KNOWN_DEFAULT_OFF_FLAGS = [", "] as const;");

const FLIPPED_ON = [
  "weigh_in_reminder_v1",
  "portion_fit_hint_v1",
  "progress_plateau_insight_v1",
] as const;

describe('growth flags flipped DEFAULT-ON ("always flag on", ENG-1279)', () => {
  const webOn = parseOn(WEB_TRACK);
  const mobileOn = parseOn(MOBILE_ANALYTICS);
  const webOff = parseOff(WEB_TRACK);
  const mobileOff = parseOff(MOBILE_ANALYTICS);

  it.each(FLIPPED_ON)("%s is registered DEFAULT-ON on both platforms", (flag) => {
    expect(webOn.has(flag), `web REDESIGN_DEFAULT_ON: ${flag}`).toBe(true);
    expect(mobileOn.has(flag), `mobile REDESIGN_DEFAULT_ON: ${flag}`).toBe(true);
  });

  it.each(FLIPPED_ON)("%s is NOT in either default-OFF list", (flag) => {
    expect(webOff.has(flag), `web KNOWN_DEFAULT_OFF_FLAGS: ${flag}`).toBe(false);
    expect(mobileOff.has(flag), `mobile KNOWN_DEFAULT_OFF_FLAGS: ${flag}`).toBe(false);
  });

  it("the two default-OFF lists remain identical (web ↔ mobile)", () => {
    expect([...webOff].sort()).toEqual([...mobileOff].sort());
  });
});
