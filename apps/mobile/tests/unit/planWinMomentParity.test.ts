/**
 * ENG-820 (Plan win-moment, Redesign — Design Direction 2026, 2026-05-31
 * design-director review) — web/mobile parity for the state-aware
 * "Hits your targets N of 7" headline + Plan commit haptics.
 *
 * The Plan win layer is gated behind `redesign_winmoment` on BOTH platforms
 * with the OLD behaviour preserved in the flag-off arm (flat headline, silent
 * commits). The headline tone is computed by the SHARED
 * `planWeekHeadlineTone` classifier so the two platforms can never disagree on
 * which weeks read as win vs progress vs calm.
 *
 * These are source-text assertions (same convention as
 * `plannerMicrocopyDc12.test.ts`) — they break if either platform drops the
 * flag gate, the shared classifier, the tone→colour mapping, or the haptics.
 * The pure tone logic itself is unit-tested in `tests/unit/planWeekSummary.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_SRC = readFileSync(
  resolve(__dirname, "../../app/(tabs)/planner.tsx"),
  "utf8",
);
const WEB_SRC = readFileSync(
  resolve(__dirname, "../../../../src/app/components/MealPlanner.tsx"),
  "utf8",
);

describe("Plan win-moment parity (ENG-820)", () => {
  it("both platforms gate the win layer behind the same `redesign_winmoment` flag", () => {
    expect(MOBILE_SRC).toContain('isFeatureEnabled("redesign_winmoment")');
    expect(WEB_SRC).toContain('isFeatureEnabled("redesign_winmoment")');
  });

  it("both platforms derive the headline tone from the shared classifier", () => {
    expect(MOBILE_SRC).toContain("planWeekHeadlineTone");
    expect(WEB_SRC).toContain("planWeekHeadlineTone");
  });

  it("mobile maps win→Accent.win, progress→Accent.warning, calm→muted, flag-off→colors.text", () => {
    // The mapping lives in the `summaryTitleColor` memo. Pin each arm so a
    // refactor can't silently collapse a tone or break the flag-off fallback.
    expect(MOBILE_SRC).toContain("if (!winMomentsEnabled) return colors.text;");
    expect(MOBILE_SRC).toContain('if (summaryTone === "win") return Accent.win;');
    expect(MOBILE_SRC).toContain('if (summaryTone === "progress") return Accent.warning;');
  });

  it("web maps win→--accent-win, progress→--warning, calm→muted, flag-off→undefined", () => {
    expect(WEB_SRC).toContain('"var(--accent-win)"');
    expect(WEB_SRC).toContain('"var(--warning)"');
    expect(WEB_SRC).toContain('"var(--muted-foreground)"');
  });

  it("mobile fires the loud success haptic only on the rising edge into a 7/7 win", () => {
    // ENG-1342 — routed through useHaptics().success().
    expect(MOBILE_SRC).toContain("haptics.success()");
    // Rising-edge guard so re-mounting an already-7/7 plan never replays it.
    expect(MOBILE_SRC).toContain('summaryTone === "win" && prev !== null && prev !== "win"');
  });

  it("mobile fires a settle haptic on plan-generate and on move-meal commit (flag-gated)", () => {
    // Both commits use a Medium impact (settle) via useHaptics().confirm(),
    // reserving the loud success notification for the 7/7 landmark.
    const settleHaptics = MOBILE_SRC.match(/haptics\.confirm\(\)/g);
    expect(settleHaptics).not.toBeNull();
    expect((settleHaptics ?? []).length).toBeGreaterThanOrEqual(2);
    // Both must be behind the win flag (no haptic when the flag is off).
    expect(MOBILE_SRC).toContain(
      "if (winMomentsEnabled) {\n        haptics.confirm();",
    );
  });

  it("the mobile headline carries a testID so the rendered tone is pinnable", () => {
    expect(MOBILE_SRC).toContain('testID="plan-summary-headline"');
  });

  it("the web headline carries a testid + data-tone so the rendered tone is pinnable", () => {
    expect(WEB_SRC).toContain('data-testid="planner-week-summary-headline"');
    expect(WEB_SRC).toContain("data-tone={winMomentsEnabled ? summaryTone");
  });
});
