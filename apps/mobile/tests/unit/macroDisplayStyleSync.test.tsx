// @vitest-environment jsdom

/**
 * Regression: when Settings flips the macro-display preference, Today's
 * already-mounted hook instance must receive the new value. Pre-fix,
 * each `useMacroDisplayStyle()` call had its own local useState — the
 * setter from one instance never reached the other, so flipping the
 * Settings toggle left Today rendering the stale style until a hard
 * remount.
 */

import { renderHook, act, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, describe, expect, it } from "vitest";

import {
  MACRO_DISPLAY_STORAGE_KEY,
  useMacroDisplayStyle,
} from "@/lib/macroDisplayStyle";

afterEach(async () => {
  await AsyncStorage.clear();
});

describe("useMacroDisplayStyle — cross-instance sync", () => {
  it("propagates setStyle to every live hook instance", async () => {
    const settings = renderHook(() => useMacroDisplayStyle());
    const today = renderHook(() => useMacroDisplayStyle());

    // Default is tiles (SLOE redesign 2026-06-03 — the Sloe `01 · Today`
    // frame shows the 2×2 macro tile grid).
    expect(settings.result.current[0]).toBe("tiles");
    expect(today.result.current[0]).toBe("tiles");

    // Settings flips to bars (the opt-in dense list).
    act(() => {
      settings.result.current[1]("bars");
    });

    // Today (a separate hook instance) must see it.
    expect(today.result.current[0]).toBe("bars");
    expect(settings.result.current[0]).toBe("bars");

    // And the write persisted.
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(MACRO_DISPLAY_STORAGE_KEY)).toBe(
        "bars",
      );
    });

    settings.unmount();
    today.unmount();
  });

  it("unsubscribes on unmount so unmounted hooks don't receive updates", async () => {
    const settings = renderHook(() => useMacroDisplayStyle());
    const today = renderHook(() => useMacroDisplayStyle());

    today.unmount();

    // Flipping after Today unmounted should not throw or warn about
    // setting state on an unmounted component.
    act(() => {
      settings.result.current[1]("bars");
    });

    expect(settings.result.current[0]).toBe("bars");

    settings.unmount();
  });
});
