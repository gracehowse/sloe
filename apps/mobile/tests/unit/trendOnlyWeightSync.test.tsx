// @vitest-environment jsdom

/**
 * ENG-713 — mobile side of the "Trend-only weight" pref (ED + dysphoria
 * dignity). Two guarantees on the mobile runtime:
 *   1. the AsyncStorage hook propagates a flip to every live instance (so
 *      flipping it in Settings updates Progress mounted underneath) — mirror of
 *      the calm-mode / macro-display cross-instance sync regression;
 *   2. the shared effective-mode helper composes the pref with the T13 DB mode
 *      identically to web (it's the same `@suppr/shared` module both import).
 */

import { renderHook, act, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, describe, expect, it } from "vitest";

import {
  TREND_ONLY_WEIGHT_STORAGE_KEY,
  useTrendOnlyWeight,
} from "@/lib/trendOnlyWeight";
import { resolveEffectiveWeightSurfaceMode } from "@suppr/shared/preferences/trendOnlyWeight";

afterEach(async () => {
  await AsyncStorage.clear();
});

describe("useTrendOnlyWeight — cross-instance sync (mobile)", () => {
  it("defaults OFF and propagates a flip to every live hook instance", async () => {
    const settings = renderHook(() => useTrendOnlyWeight());
    const progress = renderHook(() => useTrendOnlyWeight());

    expect(settings.result.current[0]).toBe(false);
    expect(progress.result.current[0]).toBe(false);

    act(() => {
      settings.result.current[1](true);
    });

    // Progress (a separate hook instance) must see the opt-in immediately.
    expect(progress.result.current[0]).toBe(true);
    expect(settings.result.current[0]).toBe(true);

    await waitFor(async () => {
      expect(await AsyncStorage.getItem(TREND_ONLY_WEIGHT_STORAGE_KEY)).toBe(
        "true",
      );
    });

    settings.unmount();
    progress.unmount();
  });
});

describe("resolveEffectiveWeightSurfaceMode (shared, mobile import)", () => {
  it("escalates a `show` surface to `trends_only` only when flag + pref are on", () => {
    expect(resolveEffectiveWeightSurfaceMode("show", true, true)).toBe("trends_only");
    // Flag off → no change (kill switch → today's behaviour exactly).
    expect(resolveEffectiveWeightSurfaceMode("show", true, false)).toBe("show");
    // Pref off → no change (feature is opt-in).
    expect(resolveEffectiveWeightSurfaceMode("show", false, true)).toBe("show");
  });

  it("never overrides a user's DB hide / trends_only back to numbers", () => {
    expect(resolveEffectiveWeightSurfaceMode("hide", true, true)).toBe("hide");
    expect(resolveEffectiveWeightSurfaceMode("trends_only", true, true)).toBe(
      "trends_only",
    );
  });
});
