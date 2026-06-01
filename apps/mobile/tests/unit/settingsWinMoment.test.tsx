/**
 * ENG-824 (Redesign — Design Direction 2026, 2026-05-31 design-director review)
 * — the quiet Settings win-moment hook (`useSettingsWinMoment`).
 *
 * This is the smaller, reserved-for-Settings beat (Health connect / target
 * save), distinct from the loud Today day-landmark celebration. The contract:
 *   - flag ON  + celebrate()  → loud SUCCESS notification haptic + `active`
 *     true (caller washes the saved card in `Accent.winSoft` / `Accent.win`).
 *   - flag OFF + celebrate()  → NO haptic, `active` stays false, `flashStyle`
 *     stays undefined (today's silent behaviour is preserved until ramp).
 *
 * Pins the WIRING (flag gate + haptic + flash lifecycle) so a refactor can't
 * silently drop the celebration or fire the loud haptic when the flag is off.
 */
import { act, renderHook } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Flag gate — flipped per-test.
const isFeatureEnabled = vi.fn((_flag: string) => false);
vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: (...args: [string]) => isFeatureEnabled(...args),
}));

// Haptics — assert the loud success beat fires (and only when flag on).
const notificationAsync = vi.fn((..._a: unknown[]) => Promise.resolve());
vi.mock("expo-haptics", () => ({
  notificationAsync: (...a: unknown[]) => notificationAsync(...a),
  NotificationFeedbackType: { Success: "success" },
}));

// `react-native` is provided by the global test shim (Platform.OS === "ios"),
// so the haptic call site runs without a local mock that would collide with
// @testing-library/react-native.

import { Accent } from "@/constants/theme";
import { useSettingsWinMoment } from "@/hooks/useSettingsWinMoment";

beforeEach(() => {
  vi.useFakeTimers();
  isFeatureEnabled.mockReturnValue(false);
  notificationAsync.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useSettingsWinMoment (ENG-824)", () => {
  it("flag ON: celebrate() fires the loud success haptic and flips active + flashStyle", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { result } = renderHook(() => useSettingsWinMoment());

    expect(result.current.active).toBe(false);
    expect(result.current.flashStyle).toBeUndefined();

    act(() => {
      result.current.celebrate();
    });

    expect(notificationAsync).toHaveBeenCalledWith("success");
    expect(result.current.active).toBe(true);
    expect(result.current.flashStyle).toEqual({
      backgroundColor: Accent.winSoft,
      borderColor: Accent.win,
    });
  });

  it("flag ON: the win-colour wash auto-clears after the flash window", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { result } = renderHook(() => useSettingsWinMoment());

    act(() => {
      result.current.celebrate();
    });
    expect(result.current.active).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(result.current.active).toBe(false);
    expect(result.current.flashStyle).toBeUndefined();
  });

  it("flag OFF: celebrate() is inert — no haptic, no flash (silent save preserved)", () => {
    isFeatureEnabled.mockReturnValue(false);
    const { result } = renderHook(() => useSettingsWinMoment());

    act(() => {
      result.current.celebrate();
    });

    expect(notificationAsync).not.toHaveBeenCalled();
    expect(result.current.active).toBe(false);
    expect(result.current.flashStyle).toBeUndefined();
  });
});
