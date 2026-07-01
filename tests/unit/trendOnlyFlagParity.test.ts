/**
 * ENG-713 — `progress_trend_only_v1` registration parity (web ↔ mobile).
 *
 * The trend-only weight toggle is flag-gated. The flag is DEFAULT-ON per the
 * "always flag on" beta-window policy (the flag only controls whether the opt-in
 * TOGGLE exists; the pref itself defaults OFF, so no behaviour changes until the
 * user flips it). Because it is default-ON via membership in
 * `REDESIGN_DEFAULT_ON`, it must be present on BOTH `src/lib/analytics/track.ts`
 * and `apps/mobile/lib/analytics.ts` — a flag registered on one side only would
 * render the toggle on one platform and hide it on the other (mirror of the
 * ENG-953 expenditure-card + ENG-955 weigh-in-reminder parity guards). It must
 * NOT also appear in either `KNOWN_DEFAULT_OFF_FLAGS` — a flag belongs to
 * exactly one default set.
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

describe("progress_trend_only_v1 flag registration (ENG-713, default-ON)", () => {
  const webOn = parseDefaultOn(WEB_TRACK);
  const mobileOn = parseDefaultOn(MOBILE_ANALYTICS);
  const webOff = parseDefaultOff(WEB_TRACK);
  const mobileOff = parseDefaultOff(MOBILE_ANALYTICS);

  it("is registered DEFAULT-ON on BOTH platforms", () => {
    expect(webOn.has("progress_trend_only_v1"), "web REDESIGN_DEFAULT_ON").toBe(true);
    expect(mobileOn.has("progress_trend_only_v1"), "mobile REDESIGN_DEFAULT_ON").toBe(true);
  });

  it("is NOT also in either default-OFF list", () => {
    expect(webOff.has("progress_trend_only_v1"), "web KNOWN_DEFAULT_OFF_FLAGS").toBe(false);
    expect(mobileOff.has("progress_trend_only_v1"), "mobile KNOWN_DEFAULT_OFF_FLAGS").toBe(false);
  });

  it("the two default-OFF lists remain identical (sanity: no drift introduced)", () => {
    expect([...webOff].sort()).toEqual([...mobileOff].sort());
  });
});
