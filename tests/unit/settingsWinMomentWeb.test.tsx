/**
 * ENG-824 (Redesign — Design Direction 2026) — web mirror of the Settings
 * win-moment hook (`useSettingsWinMoment`).
 *
 * Web has no haptics, so the beat is a WIN-colour wash on the saved card.
 * `redesign_winmoment` collapsed permanently-on (ENG-1651) — the hook no
 * longer reads any flag; `celebrate()` unconditionally flips `active` true
 * and sets `flashClass` to the win-colour Tailwind classes (caller adds them
 * to the saved card).
 *
 * Pins the WIRING (flash lifecycle) so a refactor can't silently drop the
 * celebration or flash on every render. Parity with the mobile hook test
 * (`apps/mobile/tests/unit/settingsWinMoment.test.tsx`).
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SETTINGS_WIN_FLASH_CLASS,
  useSettingsWinMoment,
} from "../../src/lib/preferences/useSettingsWinMoment.ts";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useSettingsWinMoment web (ENG-824)", () => {
  it("celebrate() flips active + flashClass to the win-colour classes (unconditional)", () => {
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

  it("the wash auto-clears after the flash window", () => {
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
});
