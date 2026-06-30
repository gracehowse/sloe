/**
 * ENG-953 — `expenditure_trend_card` registration parity (web ↔ mobile).
 *
 * The calm Expenditure card is gated by a default-OFF flag that must be present
 * in `KNOWN_DEFAULT_OFF_FLAGS` on BOTH `src/lib/analytics/track.ts` and
 * `apps/mobile/lib/analytics.ts`. A flag registered on one side only would let
 * the gated surface ship blind on the other platform (mirror of the ENG-955
 * weigh-in-reminder parity guard).
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

/** Parse `"flag_name"` entries from a `KNOWN_DEFAULT_OFF_FLAGS = [...] as const` block. */
function parseDefaultOff(src: string): Set<string> {
  const start = src.indexOf("KNOWN_DEFAULT_OFF_FLAGS = [");
  expect(start, "KNOWN_DEFAULT_OFF_FLAGS block").toBeGreaterThanOrEqual(0);
  const open = src.indexOf("[", start);
  const close = src.indexOf("]", open);
  expect(close).toBeGreaterThan(open);
  const body = src.slice(open + 1, close);
  const flags = new Set<string>();
  for (const m of body.matchAll(/"([a-z0-9_-]+)"/g)) {
    flags.add(m[1]);
  }
  return flags;
}

describe("expenditure_trend_card flag registration (ENG-953)", () => {
  const web = parseDefaultOff(WEB_TRACK);
  const mobile = parseDefaultOff(MOBILE_ANALYTICS);

  it("registers expenditure_trend_card on BOTH platforms", () => {
    expect(web.has("expenditure_trend_card"), "web").toBe(true);
    expect(mobile.has("expenditure_trend_card"), "mobile").toBe(true);
  });

  it("the two default-OFF lists remain identical", () => {
    expect([...web].sort()).toEqual([...mobile].sort());
  });
});
