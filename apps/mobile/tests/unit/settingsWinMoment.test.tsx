/**
 * ENG-824 (Redesign — Design Direction 2026, 2026-05-31 design-director review)
 * — the quiet Settings win-moment hook (`useSettingsWinMoment`).
 *
 * This is the smaller, reserved-for-Settings beat (Health connect / target
 * save), distinct from the loud Today day-landmark celebration.
 * `redesign_winmoment` collapsed permanently-on (ENG-1651) — the hook no
 * longer reads any flag; `celebrate()` unconditionally fires a loud SUCCESS
 * notification haptic and flips `active` true (caller washes the saved card
 * in `Accent.winSoft` / `Accent.win`).
 *
 * Pins the WIRING (haptic + flash lifecycle) so a refactor can't silently
 * drop the celebration or the flash.
 */
import { act, renderHook } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Haptics — assert the loud success beat fires.
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
  notificationAsync.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useSettingsWinMoment (ENG-824)", () => {
  it("celebrate() fires the loud success haptic and flips active + flashStyle (unconditional)", () => {
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

  it("the win-colour wash auto-clears after the flash window", () => {
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
});
