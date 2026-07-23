/**
 * ENG-1657 — web Today header shows the streak pip at 0-day (mobile
 * calm-streak posture) behind `streak_pip_zero_day_web_v1` (default-OFF).
 * Flag OFF keeps the legacy ≥2-day mount gate; flag ON mounts for any
 * non-negative streak count.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FLAG = "streak_pip_zero_day_web_v1";

const STREAK_PIP = readFileSync(
  resolve(process.cwd(), "src/app/components/suppr/streak-pip.tsx"),
  "utf8",
);
const WEB_DATE_HEADER = readFileSync(
  resolve(process.cwd(), "src/app/components/suppr/today-date-header.tsx"),
  "utf8",
);
const MOBILE_STREAK_PIP = readFileSync(
  resolve(process.cwd(), "apps/mobile/components/today/StreakPip.tsx"),
  "utf8",
);
const WEB_TRACK = readFileSync(
  resolve(process.cwd(), "src/lib/analytics/track.ts"),
  "utf8",
);
const MOBILE_ANALYTICS = readFileSync(
  resolve(process.cwd(), "apps/mobile/lib/analytics.ts"),
  "utf8",
);

function parseBlock(src: string, start: string, end: string): Set<string> {
  const i = src.indexOf(start);
  const j = src.indexOf(end, i);
  const block = src.slice(i, j);
  return new Set([...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
}

describe("ENG-1657 — streak pip zero-day web parity flag", () => {
  it("web StreakPip docstring matches mobile calm-streak posture (no hide-at-0)", () => {
    expect(STREAK_PIP).toMatch(/We do NOT hide a 0-day streak/);
    expect(STREAK_PIP).not.toMatch(/renders nothing/);
    expect(MOBILE_STREAK_PIP).toMatch(/We do NOT hide a 0-day streak/);
  });

  it("web TodayDateHeader gates showStreakPip behind the flag", () => {
    expect(WEB_DATE_HEADER).toContain(`isFeatureEnabled("${FLAG}")`);
    expect(WEB_DATE_HEADER).toMatch(
      /streakPipZeroDayWeb \? streakDays >= 0 : streakDays >= 2/,
    );
  });

  it("registers default-OFF on both platforms (web-only in practice)", () => {
    expect(WEB_TRACK).toContain(`"${FLAG}"`);
    expect(MOBILE_ANALYTICS).toContain(`"${FLAG}"`);

    const defaultOnStart = WEB_TRACK.indexOf("const REDESIGN_DEFAULT_ON");
    const defaultOnBlock = WEB_TRACK.slice(
      defaultOnStart,
      WEB_TRACK.indexOf("]);", defaultOnStart),
    );
    expect(defaultOnBlock).not.toContain(FLAG);

    const webOff = parseBlock(WEB_TRACK, "KNOWN_DEFAULT_OFF_FLAGS = [", "] as const;");
    const mobileOff = parseBlock(
      MOBILE_ANALYTICS,
      "KNOWN_DEFAULT_OFF_FLAGS = [",
      "] as const;",
    );
    expect(webOff.has(FLAG)).toBe(true);
    expect(mobileOff.has(FLAG)).toBe(true);
    expect([...webOff].sort()).toEqual([...mobileOff].sort());
  });
});
