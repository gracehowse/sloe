/**
 * Regression test for the launch-day perpetual-spinner bug
 * (2026-05-03).
 *
 * Symptom: returning users with a restored session saw a forever-
 * spinning loading state on Today / Library / Plan / You / Recipes
 * tab navigator if any boot-path supabase call hung or rejected.
 *
 * Root cause: data-fetch effects called their `setLoading(false)` /
 * `setOnboardingChecked(true)` setter only on the success path of an
 * awaited supabase call. When the call threw (network failure, RLS
 * denial, request abort) the setter never fired and the gate stayed
 * shut.
 *
 * Fix: try/finally guarantees the flag flips regardless of what the
 * supabase call does.
 *
 * This test exercises `useSavedLibraryRecipes` (the cleanest hook
 * surface affected) — the same fix pattern is applied across the
 * full set of offenders and is verified visually in the sim.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react-native";

// Mock supabase so the `await supabase.from(...)` chain rejects.
const supabaseFromMock = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabase: { from: supabaseFromMock },
}));

// Mock the offline cache so we can drive the warm-start path
// deterministically (a populated library that must survive a failed
// network fetch). vi.hoisted keeps the mock fns referenceable from the
// hoisted vi.mock factory.
const { getCachedSavedRecipesMock, cacheSavedRecipesMock } = vi.hoisted(() => ({
  getCachedSavedRecipesMock: vi.fn(),
  cacheSavedRecipesMock: vi.fn(),
}));
vi.mock("@/lib/offlineCache", () => ({
  getCachedSavedRecipes: getCachedSavedRecipesMock,
  cacheSavedRecipes: cacheSavedRecipesMock,
  getCachedDiscoverRecipes: vi.fn().mockResolvedValue(null),
  cacheDiscoverRecipes: vi.fn().mockResolvedValue(undefined),
}));

// Stub the modules `useSavedLibraryRecipes` pulls in so the hook can
// import without surprises in node.
vi.mock("@/lib/recipes/normalizeRecipeTitle", () => ({
  normalizeRecipeTitle: (s: string) => s,
}));

// Promise.all([saves.order(), recipes.order()]) short-circuits on the
// first rejection, leaving the second rejected promise without a handler
// from Promise.all's perspective. We attach a no-op listener for the
// duration of the test file so Node/Vitest don't flag it as a true
// unhandled rejection (the BEHAVIOUR under test — try/finally must still
// flip loading=false on rejection — is unaffected).
const swallowNetworkRejection = (reason: unknown) => {
  if (reason instanceof TypeError && reason.message === "Network request failed") return;
  // Anything else is a real test failure — re-raise.
  throw reason;
};

beforeEach(() => {
  supabaseFromMock.mockReset();
  // Default: no warm cache (cold load) so the existing spinner-regression
  // assertions keep exercising the no-data path.
  getCachedSavedRecipesMock.mockReset().mockResolvedValue(null);
  cacheSavedRecipesMock.mockReset().mockResolvedValue(undefined);
  process.on("unhandledRejection", swallowNetworkRejection);
});

afterEach(() => {
  process.off("unhandledRejection", swallowNetworkRejection);
  vi.clearAllMocks();
});

describe("useSavedLibraryRecipes — perpetual spinner regression", () => {
  it("flips loading=false when the supabase query rejects (try/finally)", async () => {
    // Build a chain that throws on the awaited terminal operation.
    // The hook calls `Promise.all([saves.order(...), recipes.order(...)])`
    // — both inner chains must reject for the outer Promise.all to reject.
    // The `process.on("unhandledRejection")` listener at the top of the
    // file swallows the orphan-second-rejection noise.
    const rejectingChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockRejectedValue(new TypeError("Network request failed")),
    };
    supabaseFromMock.mockReturnValue(rejectingChain);

    // Lazy import AFTER the mocks are in place.
    const { useSavedLibraryRecipes } = await import("@/lib/recipes");

    const { result } = renderHook(() =>
      useSavedLibraryRecipes("user-with-restored-session"),
    );

    // Initially loading=true (the gate is closed).
    expect(result.current.loading).toBe(true);

    // After the rejecting query settles, the finally block must flip
    // loading false. Without the fix this assertion times out.
    await waitFor(() => expect(result.current.loading).toBe(false), {
      timeout: 1000,
    });

    // Recipes stay empty (we couldn't load anything) — but the user
    // can now SEE the empty state instead of staring at a spinner.
    expect(result.current.recipes).toEqual([]);
  });

  it("keeps the cache-hydrated library when the live fetch fails (offline resilience)", async () => {
    // A returning user whose library was cached on a prior session.
    const cached = [
      { id: "cached-1", title: "Cached Meal" },
      { id: "cached-2", title: "Another Saved Recipe" },
    ];
    getCachedSavedRecipesMock.mockResolvedValue(cached);

    // The live saves+recipes fetch fails (flaky network / hung PostgREST).
    const rejectingChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockRejectedValue(new TypeError("Network request failed")),
    };
    supabaseFromMock.mockReturnValue(rejectingChain);

    const { useSavedLibraryRecipes } = await import("@/lib/recipes");
    const { result } = renderHook(() =>
      useSavedLibraryRecipes("returning-user-with-cache"),
    );

    await waitFor(() => expect(result.current.loading).toBe(false), {
      timeout: 1000,
    });

    // The failed fetch must NOT wipe the warm-started library to empty —
    // the user sees their last-known recipes, not a blank "no recipes" page.
    // This is the regression guard for the bare-spinner-then-empty bug.
    expect(result.current.recipes).toEqual(cached);
  });

  it("flips loading=false when there is no userId (early-return path)", async () => {
    const { useSavedLibraryRecipes } = await import("@/lib/recipes");
    const { result } = renderHook(() => useSavedLibraryRecipes(null));
    await waitFor(() => expect(result.current.loading).toBe(false), {
      timeout: 1000,
    });
    expect(result.current.recipes).toEqual([]);
  });

  it("uses background refreshing (not loading gate) when warm cache exists (ENG-1063)", async () => {
    const cached = [{ id: "cached-1", title: "Cached Meal" }];
    getCachedSavedRecipesMock.mockResolvedValue(cached);

    const slowChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: [], error: null }), 200);
          }),
      ),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    supabaseFromMock.mockReturnValue(slowChain);

    const { useSavedLibraryRecipes } = await import("@/lib/recipes");
    const { result } = renderHook(() =>
      useSavedLibraryRecipes("returning-user-with-cache"),
    );

    await waitFor(() => expect(result.current.recipes).toEqual(cached), {
      timeout: 500,
    });

    // Stale-while-revalidate: list stays visible; gate is `refreshing` not `loading`.
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);

    await waitFor(() => expect(result.current.refreshing).toBe(false), {
      timeout: 2000,
    });
  });
});
