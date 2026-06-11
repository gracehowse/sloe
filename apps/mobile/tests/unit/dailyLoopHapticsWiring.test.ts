/**
 * Daily-loop haptics wiring — Design Direction 2026 (`docs/decisions/
 * 2026-06-01-design-direction-2026.md`, spine rule 6: "alive at the moments
 * that matter").
 *
 * Pins the haptic feedback on the three repeated daily-loop commits + the one
 * daily-loop segment change, so a refactor can't silently drop the buzz:
 *
 *   - LOG MEAL (Today)   — a quiet CONFIRM beat fires once per durable commit,
 *     wired at the single `persistMealsImmediate` funnel (every log entry
 *     point — quick-add / search / saved-meal / barcode / AI — flows through
 *     it). Gated behind `redesign_motion` inside `use-win-moment`.
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

  it("the confirm haptic is wired at the single persist funnel, fired once", () => {
    // Exactly one invocation site — fired through the shared persist primitive,
    // never duplicated per log entry point (no double-buzz).
    const calls = TODAY.match(/confirmLogHapticRef\.current\(\)/g) ?? [];
    expect(calls.length).toBe(1);
  });

  it("the ref is kept current from the useWinMoment confirmLog handler", () => {
    expect(TODAY).toContain("confirmLogHapticRef.current = confirmLogHaptic");
  });

  it("the confirm haptic is gated behind redesign_motion (not the win flag)", () => {
    // The gate lives in the hook so the wiring stays a no-op until ramp.
    expect(WIN_HOOK).toContain('isFeatureEnabled("redesign_motion")');
    expect(WIN_HOOK).toContain("if (!motionEnabled) return;");
    // A LIGHT impact — quiet confirm, NOT the loud success reserved for the
    // win-moment landmark.
    expect(WIN_HOOK).toContain(
      "Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)",
    );
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
