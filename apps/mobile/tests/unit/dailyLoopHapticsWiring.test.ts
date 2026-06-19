/**
 * Daily-loop haptics wiring — Design Direction 2026 (`docs/decisions/
 * 2026-06-01-design-direction-2026.md`, spine rule 6: "alive at the moments
 * that matter").
 *
 * Pins the haptic feedback on the three repeated daily-loop commits + the one
 * daily-loop segment change, so a refactor can't silently drop the buzz:
 *
 *   - LOG MEAL (Today)   — a Medium CONFIRM beat fires once per durable commit,
 *     wired at the single `persistMealsImmediate` funnel (every log entry
 *     point — quick-add / search / saved-meal / barcode / AI — flows through
 *     it). Gated behind `redesign_motion` inside `use-win-moment`. ENG-1016
 *     raised this beat from Light → Medium: a durable log is a COMMIT, and the
 *     haptic vocabulary reserves Medium for taps that commit.
 *   - LOG WEIGHT         — a confirm (Medium) on save, with the loud
 *     SUCCESS notification reserved for the new-all-time-low landmark. Gated
 *     behind `redesign_winmoment`.
 *   - SEGMENT CHANGE     — a SELECTION beat on the Progress range picker, only
 *     on an actual change (matches the canonical `MobileSegmented` control).
 *
 * Source-text assertions (same convention as `logConfirmationMicrocopyDc12` /
 * `planWinMomentParity`) — they break if the wiring is removed, the funnel is
 * bypassed, or the once-per-change guard is dropped.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TODAY = readFileSync(
  resolve(__dirname, "../../app/(tabs)/index.tsx"),
  "utf8",
);
const PROGRESS = readFileSync(
  resolve(__dirname, "../../app/(tabs)/progress.tsx"),
  "utf8",
);
const LOG_WEIGHT = readFileSync(
  resolve(__dirname, "../../components/progress/LogWeightSheet.tsx"),
  "utf8",
);
const WIN_HOOK = readFileSync(
  resolve(__dirname, "../../hooks/use-win-moment.ts"),
  "utf8",
);

describe("Daily-loop haptics — LOG MEAL (Today)", () => {
  it("Today fires the confirm haptic on the persist-success path", () => {
    // The ref is the bridge to `useWinMoment.confirmLog` (defined later in the
    // component than `persistMealsImmediate`).
    expect(TODAY).toContain("confirmLogHapticRef.current()");
  });

  it("the confirm haptic is wired only at durable-commit funnels, once per path", () => {
    // The commit beat is invoked through the shared `confirmLogHapticRef` funnel,
    // never as a scattered raw `Haptics.impactAsync(...)` per log entry point.
    // Two distinct durable-commit code paths fire it (ENG-1016):
    //   1. `persistMealsImmediate` — the upsert funnel every add/quick-add/
    //      search/saved-meal/barcode/AI log flows through.
    //   2. the copy/duplicate path, which does its own insert (not the upsert
    //      funnel) so it invokes the ref itself.
    // Each fires exactly once per commit — no double-buzz within a single path.
    const calls = TODAY.match(/confirmLogHapticRef\.current\(\)/g) ?? [];
    expect(calls.length).toBe(2);
  });

  it("the ref is kept current from the useWinMoment confirmLog handler", () => {
    expect(TODAY).toContain("confirmLogHapticRef.current = confirmLogHaptic");
  });

  it("the confirm haptic is gated behind redesign_motion (not the win flag)", () => {
    // The gate lives in the hook so the wiring stays a no-op until ramp.
    expect(WIN_HOOK).toContain('isFeatureEnabled("redesign_motion")');
    expect(WIN_HOOK).toContain("if (!motionEnabled) return;");
  });

  it("the confirm haptic is a Medium impact — the canonical commit weight (ENG-1016)", () => {
    // A durable log is a COMMIT, so the ordinary-log beat is Medium — the same
    // weight as PressableScale haptic="confirm". The loud SUCCESS notification
    // stays reserved for the win-moment landmark (asserted in winMomentLandmark
    // tests).
    expect(WIN_HOOK).toContain(
      "void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);",
    );
  });

  it("the scattered raw per-call-site log haptics were removed (single funnel only)", () => {
    // Every Today log entry point flows through `persistMealsImmediate`, which
    // fires the commit beat once via `confirmLogHapticRef`. The legacy
    // duplicate `Haptics.impactAsync(...Light)` calls scattered across the log
    // handlers were removed so the user never gets a double-buzz.
    const lightCalls =
      TODAY.match(/Haptics\.impactAsync\(Haptics\.ImpactFeedbackStyle\.Light\)/g) ??
      [];
    expect(lightCalls.length).toBe(0);
  });
});

describe("Daily-loop haptics — LOG WEIGHT", () => {
  it("save fires a confirm (Medium) and reserves SUCCESS for the new-low landmark", () => {
    expect(LOG_WEIGHT).toContain(
      "Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)",
    );
    expect(LOG_WEIGHT).toContain(
      "Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)",
    );
  });

  it("the weigh-in haptic stays gated so the flag-off path is silent", () => {
    expect(LOG_WEIGHT).toContain('isFeatureEnabled("redesign_winmoment")');
    expect(LOG_WEIGHT).toContain("if (winMomentEnabled) {");
  });
});

describe("Daily-loop haptics — SEGMENT CHANGE (Progress range picker)", () => {
  it("the range picker fires a selection haptic only on an actual change", () => {
    expect(PROGRESS).toContain("if (!active) haptics.select();");
  });

  it("the selection haptic uses the canonical useHaptics().select() vehicle", () => {
    expect(PROGRESS).toContain('import { useHaptics } from "@/hooks/useHaptics"');
    expect(PROGRESS).toContain("const haptics = useHaptics();");
  });
});
