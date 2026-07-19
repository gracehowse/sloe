/**
 * ENG-1422 — `plan_import_excluded_lines_v1` registration parity (web ↔ mobile).
 *
 * The Plan-Import excluded-line advisory ("N low-confidence lines left out —
 * review before importing") is flag-gated. It is a trust/safety fix (the old
 * tier was an inverted signal), so it ships DEFAULT-ON at N=1 with the PostHog
 * row as the kill switch — membership in `REDESIGN_DEFAULT_ON`. A default-ON
 * flag must be present on BOTH `src/lib/analytics/track.ts` and
 * `apps/mobile/lib/analytics.ts`, or the advisory would render on one platform
 * and stay dark on the other (mirror of the ENG-713 / ENG-1279 parity guards).
 * It must NOT also appear in either `KNOWN_DEFAULT_OFF_FLAGS` — a flag belongs
 * to exactly one default set.
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

const FLAG = "plan_import_excluded_lines_v1";

describe("plan_import_excluded_lines_v1 flag registration (ENG-1422, default-ON)", () => {
  const webOn = parseOn(WEB_TRACK);
  const mobileOn = parseOn(MOBILE_ANALYTICS);
  const webOff = parseOff(WEB_TRACK);
  const mobileOff = parseOff(MOBILE_ANALYTICS);

  it("is registered DEFAULT-ON on BOTH platforms", () => {
    expect(webOn.has(FLAG), "web REDESIGN_DEFAULT_ON").toBe(true);
    expect(mobileOn.has(FLAG), "mobile REDESIGN_DEFAULT_ON").toBe(true);
  });

  it("is NOT also in either default-OFF list", () => {
    expect(webOff.has(FLAG), "web KNOWN_DEFAULT_OFF_FLAGS").toBe(false);
    expect(mobileOff.has(FLAG), "mobile KNOWN_DEFAULT_OFF_FLAGS").toBe(false);
  });

  it("the two default-OFF lists remain identical (sanity: no drift introduced)", () => {
    expect([...webOff].sort()).toEqual([...mobileOff].sort());
  });
});
