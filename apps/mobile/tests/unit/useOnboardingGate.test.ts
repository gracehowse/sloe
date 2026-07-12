/**
 * ENG-1515 — the (tabs) onboarding gate race.
 *
 * The old inline gate initialised `onboardingCompleted = true` and kept
 * that optimistic default on timeout AND error, silently skipping
 * onboarding for brand-new users on slow/failing profile fetches. The
 * gate now lives in `useOnboardingGate`: a cached confirmed completion
 * (`suppr.onboarding-completed:<userId>`) keeps the instant tab mount;
 * a session with NO cache never assumes complete.
 */
import { renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.fn<
  () => Promise<{
    data: { onboarding_completed: boolean | null } | null;
    error: { message: string } | null;
  }>
>();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => maybeSingleMock(),
        }),
      }),
    }),
  },
}));

const isFeatureDisabledMock = vi.fn((_flag: string) => false);
vi.mock("@/lib/analytics", () => ({
  isFeatureDisabled: (flag: string) => isFeatureDisabledMock(flag),
}));

import {
  resolveOnboardingGate,
  useOnboardingGate,
} from "../../hooks/useOnboardingGate";
import {
  onboardingCompletedCacheKey,
  writeOnboardingCompletedCache,
} from "../../lib/onboardingCompletedCache";

const hang = () => new Promise<never>(() => {});

describe("resolveOnboardingGate — pure decision table", () => {
  it("server truth wins in both modes: confirmed complete → tabs, confirmed incomplete → onboarding (even over a stale cache)", () => {
    for (const strict of [true, false]) {
      for (const cached of [null, true, false] as const) {
        expect(resolveOnboardingGate({ strict, cached, fetched: "complete" })).toBe("tabs");
        expect(resolveOnboardingGate({ strict, cached, fetched: "incomplete" })).toBe(
          "onboarding",
        );
      }
    }
  });

  it("strict: a cached completion keeps the instant tab mount through pending AND timeout/error", () => {
    expect(resolveOnboardingGate({ strict: true, cached: true, fetched: "pending" })).toBe("tabs");
    expect(resolveOnboardingGate({ strict: true, cached: true, fetched: "unavailable" })).toBe(
      "tabs",
    );
  });

  it("strict: NO cached completion never assumes complete — pending blocks, timeout/error routes to onboarding (the fix)", () => {
    expect(resolveOnboardingGate({ strict: true, cached: false, fetched: "pending" })).toBe(
      "pending",
    );
    expect(resolveOnboardingGate({ strict: true, cached: false, fetched: "unavailable" })).toBe(
      "onboarding",
    );
  });

  it("strict: the cache-hydration gap renders the launch screen, never tabs", () => {
    expect(resolveOnboardingGate({ strict: true, cached: null, fetched: "pending" })).toBe(
      "pending",
    );
    expect(resolveOnboardingGate({ strict: true, cached: null, fetched: "unavailable" })).toBe(
      "pending",
    );
  });

  it("legacy (kill switch thrown): optimistic-complete exactly like the pre-ENG-1515 gate", () => {
    for (const cached of [null, true, false] as const) {
      expect(resolveOnboardingGate({ strict: false, cached, fetched: "pending" })).toBe("tabs");
      expect(resolveOnboardingGate({ strict: false, cached, fetched: "unavailable" })).toBe(
        "tabs",
      );
    }
  });
});

describe("useOnboardingGate — hook behaviour", () => {
  beforeEach(async () => {
    isFeatureDisabledMock.mockReset().mockReturnValue(false);
    maybeSingleMock.mockReset();
    await AsyncStorage.clear();
  });

  it("cached user: tabs as soon as the local cache hydrates, with the profile fetch still hanging (offline fast path)", async () => {
    await writeOnboardingCompletedCache("u1");
    maybeSingleMock.mockImplementation(hang);
    const { result } = renderHook(() => useOnboardingGate("u1"));
    await waitFor(() => expect(result.current).toBe("tabs"));
  });

  it("no cache + confirmed complete: tabs, and the cache is backfilled for the next launch", async () => {
    maybeSingleMock.mockResolvedValue({ data: { onboarding_completed: true }, error: null });
    const { result } = renderHook(() => useOnboardingGate("u1"));
    await waitFor(() => expect(result.current).toBe("tabs"));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(onboardingCompletedCacheKey("u1"))).toBe("1"),
    );
  });

  it("no cache + thrown fetch error: routes to onboarding instead of assuming complete (the race being fixed)", async () => {
    maybeSingleMock.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useOnboardingGate("u1"));
    await waitFor(() => expect(result.current).toBe("onboarding"));
  });

  it("no cache + resolved supabase error: unavailable → onboarding (an error is not a confirmation of incompleteness)", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: "RLS" } });
    const { result } = renderHook(() => useOnboardingGate("u1"));
    await waitFor(() => expect(result.current).toBe("onboarding"));
  });

  it("cached user + resolved supabase error: tabs — a transient error must not kick a confirmed user out", async () => {
    await writeOnboardingCompletedCache("u1");
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: "503" } });
    const { result } = renderHook(() => useOnboardingGate("u1"));
    await waitFor(() => expect(result.current).toBe("tabs"));
  });

  it("stale cache + confirmed NOT complete (account nuked on another device): onboarding, and the cache is cleared", async () => {
    await writeOnboardingCompletedCache("u1");
    maybeSingleMock.mockResolvedValue({ data: { onboarding_completed: false }, error: null });
    const { result } = renderHook(() => useOnboardingGate("u1"));
    await waitFor(() => expect(result.current).toBe("onboarding"));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(onboardingCompletedCacheKey("u1"))).toBeNull(),
    );
  });

  it("kill switch thrown: tabs immediately — legacy optimistic gate, no cache or fetch answer needed", async () => {
    isFeatureDisabledMock.mockReturnValue(true);
    maybeSingleMock.mockImplementation(hang);
    const { result } = renderHook(() => useOnboardingGate("u1"));
    expect(result.current).toBe("tabs");
  });
});

describe("ENG-1515 wiring pins", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

  it("completion caches confirmed-complete at the persistOnboarding write site", () => {
    // The completion pipeline lives in mobile-flow.tsx on main; the
    // ENG-1507 branch extracts it to useOnboardingCompletion.ts —
    // accept either home so this pin survives that merge.
    let src = read("components/onboarding/mobile-flow.tsx");
    try {
      const extracted = read("components/onboarding/useOnboardingCompletion.ts");
      if (extracted.includes("persistOnboarding")) src = extracted;
    } catch {
      /* pre-ENG-1507 layout — mobile-flow owns the pipeline */
    }
    const persistIdx = src.indexOf("persistOnboarding(supabase");
    const cacheIdx = src.indexOf("writeOnboardingCompletedCache(userId)");
    expect(persistIdx).toBeGreaterThan(-1);
    expect(cacheIdx).toBeGreaterThan(persistIdx);
  });

  it("the (tabs) layout renders through the gate hook — no inline optimistic default left", () => {
    const src = read("app/(tabs)/_layout.tsx");
    expect(src).toContain("useOnboardingGate(session?.user?.id ?? null)");
    expect(src).not.toContain("useState(true)");
    expect(src).toContain("onboardingGate === 'pending'");
    expect(src).toContain("onboardingGate === 'onboarding'");
  });
});
