/**
 * ENG-955 — `KNOWN_DEFAULT_OFF_FLAGS` web ↔ mobile parity, and registration
 * of the `weigh_in_reminder_v1` gate on BOTH platforms.
 *
 * The two SSOT lists in `src/lib/analytics/track.ts` and
 * `apps/mobile/lib/analytics.ts` must stay in sync (mirror of the
 * REDESIGN_DEFAULT_ON parity test). A default-OFF flag missing from one side
 * would let the gated surface ship blind on that platform.
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

describe("KNOWN_DEFAULT_OFF_FLAGS web ↔ mobile parity (ENG-955)", () => {
  const web = parseDefaultOff(WEB_TRACK);
  const mobile = parseDefaultOff(MOBILE_ANALYTICS);

  it("the two lists are identical", () => {
    expect([...web].sort()).toEqual([...mobile].sort());
  });

  it("registers weigh_in_reminder_v1 on BOTH platforms", () => {
    expect(web.has("weigh_in_reminder_v1"), "web").toBe(true);
    expect(mobile.has("weigh_in_reminder_v1"), "mobile").toBe(true);
  });

  // ENG-854 — portion-fit hint gate must be registered default-OFF on both.
  it("registers portion_fit_hint_v1 on BOTH platforms (ENG-854)", () => {
    expect(web.has("portion_fit_hint_v1"), "web").toBe(true);
    expect(mobile.has("portion_fit_hint_v1"), "mobile").toBe(true);
  });
});
