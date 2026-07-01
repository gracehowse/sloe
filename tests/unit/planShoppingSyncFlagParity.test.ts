/**
 * ENG-957 — `plan_shopping_sync_v1` registration parity (web ↔ mobile).
 *
 * The plan→shopping-list edit-driven re-sync ships DEFAULT-ON per ENG-1279
 * ("always flag on" so the solo tester sees her own features). It is gated by
 * membership in `REDESIGN_DEFAULT_ON`, which must be present on BOTH
 * `src/lib/analytics/track.ts` and `apps/mobile/lib/analytics.ts` — a flag
 * registered on one side only would sync on one platform and stay dark on the
 * other (mirror of the ENG-855 distribute-anchor + ENG-953 expenditure-trend
 * parity guards). It must NOT also appear in either `KNOWN_DEFAULT_OFF_FLAGS` —
 * a flag belongs to exactly one default set.
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

const FLAG = "plan_shopping_sync_v1";

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

describe("plan_shopping_sync_v1 flag registration (ENG-957, default-ON)", () => {
  const webOn = parseDefaultOn(WEB_TRACK);
  const mobileOn = parseDefaultOn(MOBILE_ANALYTICS);
  const webOff = parseDefaultOff(WEB_TRACK);
  const mobileOff = parseDefaultOff(MOBILE_ANALYTICS);

  it("is registered DEFAULT-ON on BOTH platforms", () => {
    expect(webOn.has(FLAG), "web REDESIGN_DEFAULT_ON").toBe(true);
    expect(mobileOn.has(FLAG), "mobile REDESIGN_DEFAULT_ON").toBe(true);
  });

  it("is NOT also in either default-OFF list", () => {
    expect(webOff.has(FLAG), "web KNOWN_DEFAULT_OFF_FLAGS").toBe(false);
    expect(mobileOff.has(FLAG), "mobile KNOWN_DEFAULT_OFF_FLAGS").toBe(false);
  });
});
