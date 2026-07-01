/**
 * ENG-722 — web log-confirm checkmark hook (`useLogConfirmCheck`).
 *
 * The visual half of the commit feedback (the light haptic on all six meal-add
 * paths shipped 2026-04-28). `trigger()` flips `visible` true for
 * ~LOG_CONFIRM_CHECK_MS so the caller can mount `<LogConfirmCheck>` over the
 * Today ring; a calm sage check scale-fades in, then fades.
 *
 * Pins the WIRING so a refactor can't silently drop the per-log check or fire
 * it when it shouldn't (flag off / reduced motion). Mirror of the mobile
 * `useLogConfirmCheck` wiring test.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Flag gate — flipped per-test.
const isFeatureEnabled = vi.fn((_flag: string) => false);
vi.mock("../../src/lib/analytics/track", () => ({
  isFeatureEnabled: (...args: [string]) => isFeatureEnabled(...args),
}));

import {
  LOG_CONFIRM_CHECK_MS,
  useLogConfirmCheck,
} from "../../src/lib/preferences/useLogConfirmCheck.ts";

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

describe("useLogConfirmCheck (web, ENG-722)", () => {
  it("flag ON + motion: trigger() shows the check, then hides it after the window", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { result } = renderHook(() => useLogConfirmCheck());

    expect(result.current.visible).toBe(false);

    act(() => {
      result.current.trigger();
    });
    expect(result.current.visible).toBe(true);

    act(() => {
      vi.advanceTimersByTime(LOG_CONFIRM_CHECK_MS + 1);
    });
    expect(result.current.visible).toBe(false);
  });

  it("the window is calm — long enough to read the check, short of a celebration (< 700ms)", () => {
    // The check is restraint by design (Noom teardown element D). It must stay
    // well under the ~700ms gold win-moment so it never reads as a celebration.
    expect(LOG_CONFIRM_CHECK_MS).toBeGreaterThanOrEqual(350);
    expect(LOG_CONFIRM_CHECK_MS).toBeLessThan(700);
  });

  it("flag OFF: trigger() is inert (kill switch — no animation until ramp)", () => {
    isFeatureEnabled.mockReturnValue(false);
    const { result } = renderHook(() => useLogConfirmCheck());

    act(() => {
      result.current.trigger();
    });
    expect(result.current.visible).toBe(false);
  });

  it("gates on the log_confirm_check_v1 flag", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { result } = renderHook(() => useLogConfirmCheck());
    act(() => {
      result.current.trigger();
    });
    expect(isFeatureEnabled).toHaveBeenCalledWith("log_confirm_check_v1");
  });

  it("reduced motion: trigger() is inert even with the flag on (instant / no animation)", () => {
    isFeatureEnabled.mockReturnValue(true);
    reduceMotionMatch.mockReturnValue(true);
    const { result } = renderHook(() => useLogConfirmCheck());

    act(() => {
      result.current.trigger();
    });
    expect(result.current.visible).toBe(false);
  });

  it("re-arms when a second log lands inside the window", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { result } = renderHook(() => useLogConfirmCheck());

    act(() => {
      result.current.trigger();
    });
    act(() => {
      vi.advanceTimersByTime(LOG_CONFIRM_CHECK_MS / 2);
    });
    // Second log mid-window — still visible, and the timer restarts.
    act(() => {
      result.current.trigger();
    });
    expect(result.current.visible).toBe(true);
    act(() => {
      vi.advanceTimersByTime(LOG_CONFIRM_CHECK_MS / 2 + 1);
    });
    // The original window would have ended here; the re-arm extended it.
    expect(result.current.visible).toBe(true);
    act(() => {
      vi.advanceTimersByTime(LOG_CONFIRM_CHECK_MS / 2 + 1);
    });
    expect(result.current.visible).toBe(false);
  });
});
