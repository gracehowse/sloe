import { act, renderHook } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ENG-1373 — pins the race-elimination fix: `useWeightData` must NOT fire
 * its own `profiles` fetch on mount. `progress.tsx` (the sole call site)
 * already fetches `profiles` itself and calls `hydrateFromProfile`
 * directly; a second, independently-timed fetch from inside the hook
 * raced the host's fetch and whichever resolved last silently won,
 * producing the "GOAL/RATE em-dashes on one card, real values on
 * another, same account, same paint" class of bug from the ticket.
 *
 * `reload`/`hydrateFromProfile` remain available for explicit
 * pull-to-refresh / post-mutation call sites — this test only asserts
 * that mounting the hook standalone triggers zero Supabase calls.
 */

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

vi.mock("@/lib/refreshAdaptiveTdee", () => ({
  refreshAdaptiveTdeeForUser: vi.fn(),
}));

import { useWeightData } from "../../hooks/useWeightData";

describe("useWeightData — no mount-triggered fetch (ENG-1373)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it("fires zero Supabase calls when mounted with a userId", async () => {
    const { result } = renderHook(() => useWeightData("user-123"));

    // Flush any microtasks a stray fetch-on-mount effect might have queued.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
    // State starts empty — the host is responsible for hydrating via
    // `hydrateFromProfile`, not this hook auto-loading on its own.
    expect(result.current.weightKgByDay).toEqual({});
    expect(result.current.weightKg).toBeNull();
    expect(result.current.goalWeightKg).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("fires zero Supabase calls when mounted with no userId", async () => {
    renderHook(() => useWeightData(null));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("still exposes hydrateFromProfile for the host's own single fetch path", () => {
    const { result } = renderHook(() => useWeightData("user-123"));

    act(() => {
      result.current.hydrateFromProfile({
        weight_kg: 70,
        goal_weight_kg: 65,
        weight_kg_by_day: { "2026-07-01": 70 },
      });
    });

    expect(result.current.weightKg).toBe(70);
    expect(result.current.goalWeightKg).toBe(65);
    expect(result.current.weightKgByDay).toEqual({ "2026-07-01": 70 });
    // hydrateFromProfile is a pure state-set — no network call.
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("a partial-row hydrate (e.g. progress.tsx's post-HK-sync re-read) never clobbers goalWeightKg that a fuller fetch already set", () => {
    // ENG-1373 finding 2 (BLOCKER) regression — progress.tsx's health-sync
    // re-read SELECTs a narrower column set (previously missing
    // `goal_weight_kg` entirely) and passes that partial row straight to
    // `hydrateFromProfile`. Before the fix, `goal_weight_kg` being absent
    // from the row was indistinguishable from it being `null` on the row,
    // so this call unconditionally nulled out an already-correct goal —
    // deterministically, on every load, shortly after paint. The fix
    // (and the SELECT now including `goal_weight_kg`) must leave
    // `goalWeightKg` untouched when the key is genuinely absent from the
    // passed-in object, only resetting it when the key IS present but
    // explicitly null.
    const { result } = renderHook(() => useWeightData("user-123"));

    act(() => {
      result.current.hydrateFromProfile({
        weight_kg: 70,
        goal_weight_kg: 65,
        weight_kg_by_day: { "2026-07-01": 70 },
      });
    });
    expect(result.current.goalWeightKg).toBe(65);

    // Simulate a narrower re-read (e.g. `steps_by_day, weight_kg_by_day,
    // weight_kg` with no `goal_weight_kg` key at all on the object).
    act(() => {
      result.current.hydrateFromProfile({
        weight_kg: 71,
        weight_kg_by_day: { "2026-07-01": 70, "2026-07-02": 71 },
      });
    });

    // goalWeightKg must survive untouched — the key was absent, not null.
    expect(result.current.goalWeightKg).toBe(65);
    // weight_kg / weight_kg_by_day (present in the partial row) still update.
    expect(result.current.weightKg).toBe(71);
    expect(result.current.weightKgByDay).toEqual({
      "2026-07-01": 70,
      "2026-07-02": 71,
    });
  });

  it("still clears goalWeightKg when the row explicitly carries goal_weight_kg: null (user cleared their goal)", () => {
    const { result } = renderHook(() => useWeightData("user-123"));

    act(() => {
      result.current.hydrateFromProfile({
        weight_kg: 70,
        goal_weight_kg: 65,
        weight_kg_by_day: {},
      });
    });
    expect(result.current.goalWeightKg).toBe(65);

    act(() => {
      result.current.hydrateFromProfile({
        weight_kg: 70,
        goal_weight_kg: null,
        weight_kg_by_day: {},
      });
    });
    expect(result.current.goalWeightKg).toBeNull();
  });

  it("reload() remains callable explicitly (pull-to-refresh) and does fetch", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { weight_kg: 68, goal_weight_kg: 60, weight_kg_by_day: {} },
            error: null,
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useWeightData("user-123"));

    expect(fromMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.reload();
    });

    expect(fromMock).toHaveBeenCalledWith("profiles");
    expect(result.current.weightKg).toBe(68);
    expect(result.current.goalWeightKg).toBe(60);
  });
});
