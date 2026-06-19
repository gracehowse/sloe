/**
 * DailyRing — per-commit pulse (ENG-1016), the web colour/scale analog of
 * mobile's Medium commit haptic.
 *
 * Web has no haptics. Mobile fires a Medium "confirm" beat on every durable
 * log commit; the web counterpart is a brief, subtle scale-up + soft brand
 * glow on the calorie ring, driven by `useCommitPulse` and gated behind the
 * SAME `redesign_motion` flag mobile's `confirmLog` uses.
 *
 * Source-text assertions (the established convention for this heavily
 * context-dependent component — see `dailyRingMotionWinMoment.test.ts`). They
 * break if the commit pulse is dropped, if it collides with the louder
 * once-per-day win celebration, or if the web/mobile gate parity is lost.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RING_SRC = readFileSync(
  resolve(__dirname, "../../src/app/components/suppr/daily-ring.tsx"),
  "utf8",
);
const HOOK_SRC = readFileSync(
  resolve(__dirname, "../../src/lib/preferences/useCommitPulse.ts"),
  "utf8",
);

describe("DailyRing per-commit pulse (ENG-1016)", () => {
  it("accepts a commitPulse prop distinct from the win-moment pulse", () => {
    expect(RING_SRC).toContain("commitPulse?: boolean;");
    expect(RING_SRC).toContain("commitPulse = false,");
    // The two beats are distinct: pulse (gold win celebration) stays separate.
    expect(RING_SRC).toContain("pulse = false,");
  });

  it("gives a brief, subtle scale-up while commitPulse is true", () => {
    expect(RING_SRC).toContain('data-commit-pulse={commitPulse ? "true" : undefined}');
    expect(RING_SRC).toContain('commitPulse ? "scale-[1.03] duration-150"');
  });

  it("applies a soft BRAND glow on commit — never the gold win glow", () => {
    // The commit beat uses the calorie arc's own plum hue (--macro-calories),
    // so it reads distinct from the landmark celebration's gold (--accent-win).
    expect(RING_SRC).toContain(
      '"drop-shadow(0 0 6px var(--macro-calories))"',
    );
    // The gold win glow still takes priority while celebrating.
    expect(RING_SRC).toContain("filter: celebrating");
    expect(RING_SRC).toContain('"drop-shadow(0 0 8px var(--accent-win))"');
  });
});

describe("useCommitPulse parity with mobile commit haptic", () => {
  it("is gated behind the SAME redesign_motion flag mobile's confirmLog uses", () => {
    expect(HOOK_SRC).toContain('isFeatureEnabled("redesign_motion")');
  });

  it("honours prefers-reduced-motion (no pulse), like the odometer + win hooks", () => {
    expect(HOOK_SRC).toContain('"(prefers-reduced-motion: reduce)"');
  });

  it("the commit pulse window is shorter than the win-moment pulse (different beats)", () => {
    // WEB_COMMIT_PULSE_MS < WEB_WIN_PULSE_MS (200) — the commit beat is the
    // quiet per-log analog, the win pulse is the loud once-per-day celebration.
    const m = HOOK_SRC.match(/WEB_COMMIT_PULSE_MS\s*=\s*(\d+)/);
    expect(m).not.toBeNull();
    const ms = Number(m?.[1]);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThan(200);
  });
});
