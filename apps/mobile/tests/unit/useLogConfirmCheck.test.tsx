// @vitest-environment jsdom
/**
 * ENG-722 — mobile log-confirm checkmark hook (`useLogConfirmCheck`).
 *
 * The VISUAL half of the commit feedback (the light haptic on all six meal-add
 * paths shipped 2026-04-28). `trigger()` bumps a counter the caller feeds to
 * `<LogConfirmCheck bump={...}>`; each bump plays a calm sage check over the
 * Today ring. Pins the gate matrix so a refactor can't silently drop the check
 * or fire it when it shouldn't:
 *
 *   - flag ON  + motion allowed → trigger() increments bump
 *   - flag ON  + reduce-motion  → trigger() is inert (no animation / instant)
 *   - flag OFF (kill switch)     → trigger() is inert
 *
 * Mirror of the web `useLogConfirmCheck` wiring test.
 */
import { act, renderHook } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Flag gate — flipped per-test.
const isFeatureEnabled = vi.fn((_flag: string) => false);
vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: (...args: [string]) => isFeatureEnabled(...args),
}));

// Reduce-motion — flipped per-test.
const reduceMotion = vi.fn(() => false);
vi.mock("@/hooks/use-reduce-motion", () => ({
  useReduceMotion: () => reduceMotion(),
}));

import { useLogConfirmCheck } from "../../hooks/useLogConfirmCheck";

beforeEach(() => {
  isFeatureEnabled.mockReturnValue(false);
  reduceMotion.mockReturnValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useLogConfirmCheck (mobile, ENG-722)", () => {
  it("flag ON + motion: trigger() increments bump (the check plays)", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { result } = renderHook(() => useLogConfirmCheck());

    expect(result.current.bump).toBe(0);
    act(() => {
      result.current.trigger();
    });
    expect(result.current.bump).toBe(1);
    act(() => {
      result.current.trigger();
    });
    expect(result.current.bump).toBe(2);
  });

  it("gates on the log_confirm_check_v1 flag", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { result } = renderHook(() => useLogConfirmCheck());
    act(() => {
      result.current.trigger();
    });
    expect(isFeatureEnabled).toHaveBeenCalledWith("log_confirm_check_v1");
  });

  it("flag OFF: trigger() is inert (kill switch — no animation until ramp)", () => {
    isFeatureEnabled.mockReturnValue(false);
    const { result } = renderHook(() => useLogConfirmCheck());

    act(() => {
      result.current.trigger();
    });
    expect(result.current.bump).toBe(0);
  });

  it("reduced motion: trigger() is inert even with the flag on (instant / no animation)", () => {
    isFeatureEnabled.mockReturnValue(true);
    reduceMotion.mockReturnValue(true);
    const { result } = renderHook(() => useLogConfirmCheck());

    act(() => {
      result.current.trigger();
    });
    expect(result.current.bump).toBe(0);
  });
});
