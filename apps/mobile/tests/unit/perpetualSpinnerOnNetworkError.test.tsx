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

// Stub the modules `useSavedLibraryRecipes` pulls in so the hook can
// import without surprises in node.
vi.mock("@/lib/recipes/normalizeRecipeTitle", () => ({
  normalizeRecipeTitle: (s: string) => s,
}));
vi.mock("@/lib/recipes/pickDefaultImage", () => ({
  pickDefaultImage: () => "data:image/png;base64,",
}));

beforeEach(() => {
  supabaseFromMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSavedLibraryRecipes — perpetual spinner regression", () => {
  it("flips loading=false when the supabase query rejects (try/finally)", async () => {
    // Build a chain that throws on the awaited terminal operation.
    // The hook calls `Promise.all([saves.order(...), recipes.order(...)])`
    // — Promise.all short-circuits on the first rejection, leaving the
    // second rejected promise "unhandled" from Node's perspective. Pre-
    // attaching a no-op .catch silences the unhandled-rejection warning
    // without changing what the awaiter (the hook) actually observes.
    const rejectingChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(() => {
        const p = Promise.reject(new TypeError("Network request failed"));
        p.catch(() => {});
        return p;
      }),
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

  it("flips loading=false when there is no userId (early-return path)", async () => {
    const { useSavedLibraryRecipes } = await import("@/lib/recipes");
    const { result } = renderHook(() => useSavedLibraryRecipes(null));
    await waitFor(() => expect(result.current.loading).toBe(false), {
      timeout: 1000,
    });
    expect(result.current.recipes).toEqual([]);
  });
});
