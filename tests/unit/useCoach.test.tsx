/**
 * useCoach (web) — Today "what to eat next" data hook.
 *
 * Pins the non-blocking contract:
 *   - the deterministic candidate set is available SYNCHRONOUSLY from the
 *     library (no spinner, no empty flash)
 *   - an AI ranking from the route swaps in, folded onto the LOCAL
 *     candidates so the numbers stay the screen's own
 *   - any fetch failure / deterministic server answer leaves the local
 *     deterministic result in place (surface never empties)
 *
 * Mirror of `apps/mobile/lib/useCoach.ts` — same logic; only the auth
 * transport differs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useCoach } from "@/lib/today/useCoach";
import type { NorthStarRecipe } from "@/lib/nutrition/northStarSuggestion";

const library: NorthStarRecipe[] = [
  { id: "a", title: "A", calories: 510, protein: 30, carbs: 40, fat: 15, mealType: null },
  { id: "b", title: "B", calories: 700, protein: 25, carbs: 50, fat: 20, mealType: null },
  { id: "c", title: "C", calories: 520, protein: 35, carbs: 38, fat: 14, mealType: null },
];

const remaining = {
  calories: 1200,
  protein: 60,
  carbs: 120,
  fat: 40,
  dailyCalorieTarget: 2000,
};

describe("useCoach (web)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns deterministic candidates synchronously on first render", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))); // never resolves
    const { result } = renderHook(() =>
      useCoach({ library, remaining, slot: "dinner" }),
    );
    expect(result.current.candidates.length).toBeGreaterThanOrEqual(2);
    expect(result.current.source).toBe("deterministic");
  });

  it("swaps in the AI ranking + phrasing, folded onto local numbers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          source: "ai",
          candidates: [
            { recipeId: "c", whyLine: "Tops up your protein" },
            { recipeId: "a", whyLine: "A lighter pick" },
          ],
        }),
      })),
    );
    const { result } = renderHook(() =>
      useCoach({ library, remaining, slot: "dinner" }),
    );
    await waitFor(() => expect(result.current.source).toBe("ai"));
    expect(result.current.candidates[0].recipeId).toBe("c");
    expect(result.current.candidates[0].whyLine).toBe("Tops up your protein");
    // Numbers are the LOCAL ones (one serving from the library), not server.
    expect(result.current.candidates[0].predictedCalories).toBe(520);
  });

  it("keeps deterministic candidates when the route answers deterministically", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, source: "deterministic", candidates: [] }),
      })),
    );
    const { result } = renderHook(() =>
      useCoach({ library, remaining, slot: "dinner" }),
    );
    await waitFor(() => expect(result.current.refining).toBe(false));
    expect(result.current.source).toBe("deterministic");
    expect(result.current.candidates.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps deterministic candidates on a fetch failure (surface never empties)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    const { result } = renderHook(() =>
      useCoach({ library, remaining, slot: "dinner" }),
    );
    await waitFor(() => expect(result.current.refining).toBe(false));
    expect(result.current.source).toBe("deterministic");
    expect(result.current.candidates.length).toBeGreaterThanOrEqual(2);
  });

  it("does not fetch when fewer than 2 candidates fit (nothing to re-rank)", () => {
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() =>
      useCoach({
        library: [library[0]],
        remaining,
        slot: "dinner",
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch when disabled", () => {
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() =>
      useCoach({ library, remaining, slot: "dinner", enabled: false }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
