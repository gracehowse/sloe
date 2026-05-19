// @vitest-environment jsdom

/**
 * Tare aesthetic gate (mobile) — preview override + flag resolution.
 *
 * Mirrors the web test at `tests/unit/tareAestheticGate.test.tsx`
 * (which the Phase 1.0 reset deleted) — same resolution-order pin,
 * adapted for the mobile architecture (AsyncStorage + PostHog flag,
 * no URL params).
 *
 * Resolution order on `useTareEnabled()` (first match wins):
 *   1. AsyncStorage `suppr.tare-preview`
 *   2. PostHog flag `tare-aesthetic-v1`
 *
 * Why pin: the Tare aesthetic foundation gates every visible-change
 * increment Grace previews per-device before ramp. If the resolution
 * order ever drifts (e.g. flag silently wins over the AsyncStorage
 * override) Grace's preview would be misleading. This pin trips.
 */

import { renderHook, act, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TARE_PREVIEW_KEY,
  useTareEnabled,
  useTarePalette,
  useTarePreview,
  writeTarePreview,
} from "@/lib/tareAesthetic";

// Mock the flag helper so each test controls its own flag state.
let mockFlag = false;
vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: (_flag: string) => mockFlag,
}));

// Default useColorScheme to "light" so palette tests are deterministic.
vi.mock("react-native", async () => {
  const actual = await vi.importActual<typeof import("react-native")>("react-native");
  return {
    ...actual,
    useColorScheme: () => "light",
  };
});

beforeEach(() => {
  mockFlag = false;
});

afterEach(async () => {
  await AsyncStorage.clear();
});

describe("useTareEnabled — preview override + flag resolution", () => {
  it("flag off + no override → returns false", () => {
    mockFlag = false;
    const { result } = renderHook(() => useTareEnabled());
    expect(result.current).toBe(false);
  });

  it("flag on + no override → returns true", () => {
    mockFlag = true;
    const { result } = renderHook(() => useTareEnabled());
    expect(result.current).toBe(true);
  });

  it("AsyncStorage `on` beats flag off (preview wins)", async () => {
    mockFlag = false;
    await AsyncStorage.setItem(TARE_PREVIEW_KEY, "on");
    const { result } = renderHook(() => useTareEnabled());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("AsyncStorage `off` beats flag on (opt-out wins)", async () => {
    mockFlag = true;
    await AsyncStorage.setItem(TARE_PREVIEW_KEY, "off");
    const { result } = renderHook(() => useTareEnabled());
    await waitFor(() => expect(result.current).toBe(false));
  });

  it("malformed AsyncStorage value is ignored (defers to flag)", async () => {
    mockFlag = true;
    await AsyncStorage.setItem(TARE_PREVIEW_KEY, "banana");
    const { result } = renderHook(() => useTareEnabled());
    // The value isn't "on" or "off" → parsed as null → flag wins.
    await waitFor(() => expect(result.current).toBe(true));
  });
});

describe("useTarePreview — Settings toggle wiring", () => {
  it("setting `on` updates state + persists to AsyncStorage", async () => {
    const { result } = renderHook(() => useTarePreview());
    expect(result.current[0]).toBe(null);

    act(() => {
      result.current[1]("on");
    });

    expect(result.current[0]).toBe("on");
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(TARE_PREVIEW_KEY)).toBe("on");
    });
  });

  it("setting `null` clears the persisted override", async () => {
    await AsyncStorage.setItem(TARE_PREVIEW_KEY, "on");
    const { result } = renderHook(() => useTarePreview());

    // Wait for the initial async read to land.
    await waitFor(() => expect(result.current[0]).toBe("on"));

    act(() => {
      result.current[1](null);
    });

    expect(result.current[0]).toBe(null);
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(TARE_PREVIEW_KEY)).toBe(null);
    });
  });

  it("propagates setPreview across live hook instances", async () => {
    const settings = renderHook(() => useTarePreview());
    const today = renderHook(() => useTarePreview());

    act(() => {
      settings.result.current[1]("on");
    });

    // Today (a separate hook instance) must see the flip without
    // a remount — the pub/sub keeps both subscribers in sync.
    expect(today.result.current[0]).toBe("on");
    expect(settings.result.current[0]).toBe("on");

    settings.unmount();
    today.unmount();
  });

  it("writeTarePreview from a non-hook caller still notifies subscribers", async () => {
    const today = renderHook(() => useTarePreview());

    // Wait for the initial useEffect to subscribe the hook before
    // calling the non-hook writer — without this, the subscribers
    // Set is empty when writeTarePreview's forEach runs.
    await waitFor(() => {
      expect(today.result.current[0]).toBe(null);
    });

    await act(async () => {
      await writeTarePreview("on");
    });

    await waitFor(() => {
      expect(today.result.current[0]).toBe("on");
    });
    today.unmount();
  });
});

describe("useTarePalette — palette resolution", () => {
  it("returns null when gate is off (fallback to legacy Accent)", () => {
    mockFlag = false;
    const { result } = renderHook(() => useTarePalette());
    expect(result.current).toBe(null);
  });

  it("returns the light palette when gate is on + scheme light", async () => {
    mockFlag = true;
    const { result } = renderHook(() => useTarePalette());
    await waitFor(() => expect(result.current).not.toBe(null));
    expect(result.current?.bg).toBe("#f1ebdf");
    expect(result.current?.accent).toBe("#14141a");
    // Phase 0.8 softened macros:
    expect(result.current?.macroProtein).toBe("#5b6fb8");
    expect(result.current?.macroCarbs).toBe("#c87935");
    expect(result.current?.macroFat).toBe("#c4708a");
    expect(result.current?.macroFiber).toBe("#5d8a5c");
    // Fonts default to family names (deferred font load — see
    // comments in constants/tareTokens.ts).
    expect(result.current?.fontSans).toBe("Inter");
    expect(result.current?.fontSerif).toBe("Newsreader");
  });
});
