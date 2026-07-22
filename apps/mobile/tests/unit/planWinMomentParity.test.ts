/**
 * ENG-820 (Plan win-moment, Redesign — Design Direction 2026, 2026-05-31
 * design-director review) — web/mobile parity for the state-aware
 * "Hits your targets N of 7" headline + Plan commit haptics.
 *
 * `redesign_winmoment` collapsed permanently-on (ENG-1651): it was permanently
 * ON via REDESIGN_DEFAULT_ON on both platforms since 2026-06-01, so the gate
 * was removed from source entirely and the win layer (state-aware headline +
 * commit haptics) now ships unconditionally — there is no flag-off arm left
 * to preserve. The headline tone is still computed by the SHARED
 * `planWeekHeadlineTone` classifier so the two platforms can never disagree on
 * which weeks read as win vs progress vs calm.
 *
 * These are source-text assertions (same convention as
 * `plannerMicrocopyDc12.test.ts`) — they break if either platform re-adds a
 * flag gate, drops the shared classifier, the tone→colour mapping, or the
 * haptics. The pure tone logic itself is unit-tested in
 * `tests/unit/planWeekSummary.test.ts`.
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
  it("both platforms collapsed the `redesign_winmoment` gate permanently-on (ENG-1651)", () => {
    expect(MOBILE_SRC).not.toContain('isFeatureEnabled("redesign_winmoment")');
    expect(WEB_SRC).not.toContain('isFeatureEnabled("redesign_winmoment")');
  });

  it("both platforms derive the headline tone from the shared classifier", () => {
    expect(MOBILE_SRC).toContain("planWeekHeadlineTone");
    expect(WEB_SRC).toContain("planWeekHeadlineTone");
  });

  it("mobile maps win→Accent.win, progress→Accent.warning, calm→muted (flag collapsed, no flag-off arm)", () => {
    // The mapping lives in the `summaryTitleColor` memo. Pin each arm so a
    // refactor can't silently collapse a tone.
    expect(MOBILE_SRC).toContain('if (summaryTone === "win") return Accent.win;');
    expect(MOBILE_SRC).toContain('if (summaryTone === "progress") return Accent.warning;');
  });

  it("web maps win→--accent-win, progress→--warning, calm→muted", () => {
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

  it("mobile fires a settle haptic on plan-generate and on move-meal commit (unconditional, flag collapsed)", () => {
    // Both commits use a Medium impact (settle) via useHaptics().confirm(),
    // reserving the loud success notification for the 7/7 landmark. Both
    // fire unconditionally now — no flag wrapper left to gate them off.
    const settleHaptics = MOBILE_SRC.match(/haptics\.confirm\(\)/g);
    expect(settleHaptics).not.toBeNull();
    expect((settleHaptics ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("the mobile headline carries a testID so the rendered tone is pinnable", () => {
    expect(MOBILE_SRC).toContain('testID="plan-summary-headline"');
  });

  it("the web headline carries a testid + data-tone so the rendered tone is pinnable", () => {
    expect(WEB_SRC).toContain('data-testid="planner-week-summary-headline"');
    expect(WEB_SRC).toContain("data-tone={summaryTone}");
  });
});
