/**
 * useCoach (mobile) — refining stuck-path hardening (ENG-1294).
 *
 * Mirror of the ENG-1294 cases in the web `tests/unit/useCoach.test.tsx`:
 *   - the effect's early-return path (decision space shrinks / hook
 *     disabled mid-flight) resets `refining` instead of stranding it true
 *   - the AI improvement fetch carries an AbortSignal and is aborted after
 *     the ~10s client timeout, resetting `refining` and leaving the
 *     deterministic candidates in place
 *
 * The transport differs from web (authedFetch + getSupprApiBase), so the
 * mobile hook needs its own pin even though the logic is kept aligned.
 */
import { act, renderHook } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authedFetchMock = vi.fn();

vi.mock("@/lib/authedFetch", () => ({
  authedFetch: (...args: [string, RequestInit?]) => authedFetchMock(...args),
}));

vi.mock("@/lib/supprWeb", () => ({
  getSupprApiBase: () => "https://example.test",
}));

import useCoach, { COACH_REFINE_TIMEOUT_MS } from "../../lib/useCoach";
import type { NorthStarRecipe } from "@suppr/nutrition-core/northStarSuggestion";

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

describe("useCoach (mobile) — refining reset + timeout (ENG-1294)", () => {
  beforeEach(() => {
    authedFetchMock.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns deterministic candidates synchronously and marks refining while the fetch is in flight", () => {
    authedFetchMock.mockImplementation(() => new Promise(() => {})); // never settles
    const { result } = renderHook(() =>
      useCoach({ library, remaining, slot: "dinner" }),
    );
    expect(result.current.candidates.length).toBeGreaterThanOrEqual(2);
    expect(result.current.source).toBe("deterministic");
    expect(result.current.refining).toBe(true);
  });

  it("resets refining when the candidate set shrinks below the fetch threshold mid-flight", () => {
    authedFetchMock.mockImplementation(() => new Promise(() => {})); // never settles
    const { result, rerender } = renderHook(
      ({ lib }: { lib: NorthStarRecipe[] }) =>
        useCoach({ library: lib, remaining, slot: "dinner" }),
      { initialProps: { lib: library } },
    );
    expect(result.current.refining).toBe(true);
    rerender({ lib: [library[0]] });
    expect(result.current.refining).toBe(false);
  });

  it("resets refining when the hook is disabled mid-flight", () => {
    authedFetchMock.mockImplementation(() => new Promise(() => {})); // never settles
    const { result, rerender } = renderHook(
      ({ on }: { on: boolean }) =>
        useCoach({ library, remaining, slot: "dinner", enabled: on }),
      { initialProps: { on: true } },
    );
    expect(result.current.refining).toBe(true);
    rerender({ on: false });
    expect(result.current.refining).toBe(false);
  });

  it("passes an abort signal and aborts a hung fetch after the client timeout", async () => {
    vi.useFakeTimers();
    authedFetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<never>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const { result } = renderHook(() =>
      useCoach({ library, remaining, slot: "dinner" }),
    );
    expect(result.current.refining).toBe(true);
    const init = authedFetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(COACH_REFINE_TIMEOUT_MS + 1);
    });
    expect(result.current.refining).toBe(false);
    // Deterministic candidates stand — the surface never empties.
    expect(result.current.source).toBe("deterministic");
    expect(result.current.candidates.length).toBeGreaterThanOrEqual(2);
  });
});
