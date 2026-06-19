/**
 * ENG-1016 — web commit-pulse hook (`useCommitPulse`).
 *
 * Web has no haptics. Mobile fires a Medium "confirm" impact on every durable
 * commit (log meal / save) via `useWinMoment.confirmLog`, gated behind
 * `redesign_motion`. This hook is the web analog: `trigger()` flips `pulse`
 * true for ~160ms so the caller can wash a brief scale + brand glow over the
 * commit surface (the Today calorie ring).
 *
 * Pins the WIRING so a refactor can't silently drop the per-commit beat or
 * fire it when it shouldn't (flag off / reduced motion). Parity with the
 * mobile commit-haptic wiring test (`dailyLoopHapticsWiring.test.ts`).
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Flag gate — flipped per-test.
const isFeatureEnabled = vi.fn((_flag: string) => false);
vi.mock("../../src/lib/analytics/track", () => ({
  isFeatureEnabled: (...args: [string]) => isFeatureEnabled(...args),
}));

import {
  WEB_COMMIT_PULSE_MS,
  useCommitPulse,
} from "../../src/lib/preferences/useCommitPulse.ts";

const reduceMotionMatch = vi.fn(() => false);

beforeEach(() => {
  vi.useFakeTimers();
  isFeatureEnabled.mockReturnValue(false);
  reduceMotionMatch.mockReturnValue(false);
  // Stub matchMedia so the reduced-motion guard is controllable.
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("reduced-motion") ? reduceMotionMatch() : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useCommitPulse (web, ENG-1016)", () => {
  it("flag ON: trigger() flips pulse true, then back to false after the window", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { result } = renderHook(() => useCommitPulse());

    expect(result.current.pulse).toBe(false);

    act(() => {
      result.current.trigger();
    });
    expect(result.current.pulse).toBe(true);

    act(() => {
      vi.advanceTimersByTime(WEB_COMMIT_PULSE_MS + 1);
    });
    expect(result.current.pulse).toBe(false);
  });

  it("the pulse window is short + subtle — a commit beat, not the 200ms win celebration", () => {
    // The commit beat is the analog of a <100ms haptic tap; it must stay
    // shorter than the win-moment pulse (WEB_WIN_PULSE_MS = 200) so the two
    // beats read as different intensities.
    expect(WEB_COMMIT_PULSE_MS).toBeLessThan(200);
  });

  it("flag OFF: trigger() is inert (today's silent log preserved until ramp)", () => {
    isFeatureEnabled.mockReturnValue(false);
    const { result } = renderHook(() => useCommitPulse());

    act(() => {
      result.current.trigger();
    });
    expect(result.current.pulse).toBe(false);
  });

  it("gated behind the SAME redesign_motion flag mobile's confirmLog uses (parity)", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { result } = renderHook(() => useCommitPulse());
    act(() => {
      result.current.trigger();
    });
    expect(isFeatureEnabled).toHaveBeenCalledWith("redesign_motion");
  });

  it("reduced motion: trigger() is inert even with the flag on", () => {
    isFeatureEnabled.mockReturnValue(true);
    reduceMotionMatch.mockReturnValue(true);
    const { result } = renderHook(() => useCommitPulse());

    act(() => {
      result.current.trigger();
    });
    expect(result.current.pulse).toBe(false);
  });

  it("re-arms cleanly when a second commit lands inside the window", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { result } = renderHook(() => useCommitPulse());

    act(() => {
      result.current.trigger();
    });
    act(() => {
      vi.advanceTimersByTime(WEB_COMMIT_PULSE_MS / 2);
    });
    // Second commit mid-window — pulse should stay true and the timer restart.
    act(() => {
      result.current.trigger();
    });
    expect(result.current.pulse).toBe(true);
    act(() => {
      vi.advanceTimersByTime(WEB_COMMIT_PULSE_MS / 2 + 1);
    });
    // The original window would have ended here, but the re-arm extended it.
    expect(result.current.pulse).toBe(true);
    act(() => {
      vi.advanceTimersByTime(WEB_COMMIT_PULSE_MS / 2 + 1);
    });
    expect(result.current.pulse).toBe(false);
  });
});
