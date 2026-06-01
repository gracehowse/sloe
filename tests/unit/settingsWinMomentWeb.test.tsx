/**
 * ENG-824 (Redesign — Design Direction 2026) — web mirror of the Settings
 * win-moment hook (`useSettingsWinMoment`).
 *
 * Web has no haptics, so the beat is a WIN-colour wash on the saved card:
 *   - flag ON  + celebrate()  → `active` true + `flashClass` = the win-colour
 *     Tailwind classes (caller adds them to the saved card).
 *   - flag OFF + celebrate()  → `active` stays false, `flashClass` is `""`
 *     (today's silent save preserved until ramp).
 *
 * Pins the WIRING (flag gate + flash lifecycle) so a refactor can't silently
 * drop the celebration or flash on every render. Parity with the mobile hook
 * test (`apps/mobile/tests/unit/settingsWinMoment.test.tsx`).
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Flag gate — flipped per-test.
const isFeatureEnabled = vi.fn((_flag: string) => false);
vi.mock("../../src/lib/analytics/track", () => ({
  isFeatureEnabled: (...args: [string]) => isFeatureEnabled(...args),
}));

import {
  SETTINGS_WIN_FLASH_CLASS,
  useSettingsWinMoment,
} from "../../src/lib/preferences/useSettingsWinMoment.ts";

beforeEach(() => {
  vi.useFakeTimers();
  isFeatureEnabled.mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useSettingsWinMoment web (ENG-824)", () => {
  it("flag ON: celebrate() flips active + flashClass to the win-colour classes", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { result } = renderHook(() => useSettingsWinMoment());

    expect(result.current.active).toBe(false);
    expect(result.current.flashClass).toBe("");

    act(() => {
      result.current.celebrate();
    });

    expect(result.current.active).toBe(true);
    expect(result.current.flashClass).toBe(SETTINGS_WIN_FLASH_CLASS);
    // Win-colour token, never success-green (green is reserved for the ring).
    expect(SETTINGS_WIN_FLASH_CLASS).toContain("accent-win");
  });

  it("flag ON: the wash auto-clears after the flash window", () => {
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
    expect(result.current.flashClass).toBe("");
  });

  it("flag OFF: celebrate() is inert — no flash (silent save preserved)", () => {
    isFeatureEnabled.mockReturnValue(false);
    const { result } = renderHook(() => useSettingsWinMoment());

    act(() => {
      result.current.celebrate();
    });

    expect(result.current.active).toBe(false);
    expect(result.current.flashClass).toBe("");
  });
});
