/**
 * ENG-1631 (Planner extract, slice 1) — behaviour tests for
 * `usePlannerTemplates`, the plan-templates-sheet loading-state cluster
 * (4 pieces of state + 1 fetch effect) extracted verbatim from
 * `planner.tsx`.
 *
 * Mirrors `useTodayFasting.test.ts` (the TodayScreen sibling slice):
 * covers the hook's OWN responsibility — fetch-gating (open + userId),
 * the loading flag, the raw setters `<PlanTemplatesSheet>`'s onSave/
 * onApply/onDelete callbacks hydrate through, and the retry-on-error path
 * (network vs generic message, "Try again" bumping the private retry
 * counter, "Cancel" closing the sheet, and a stale response after close
 * not resurrecting state).
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Alert } from "react-native";

const listPlanTemplatesMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {},
}));

vi.mock("@suppr/nutrition-core/planTemplatesClient", () => ({
  listPlanTemplates: (...args: [unknown, string]) => listPlanTemplatesMock(...args),
}));

import { usePlannerTemplates } from "../../hooks/usePlannerTemplates";
import type { PlanTemplate } from "@suppr/nutrition-core/planTemplates";

const TEMPLATE: PlanTemplate = {
  id: "tmpl-1",
  userId: "user-1",
  name: "Standard week",
  dayCount: 7,
  slots: [],
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("usePlannerTemplates", () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    listPlanTemplatesMock.mockReset();
    listPlanTemplatesMock.mockResolvedValue({ templates: [TEMPLATE], error: null });
    alertSpy = vi.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("starts closed, with an empty template list and not loading — no fetch fires", () => {
    const { result } = renderHook(() => usePlannerTemplates({ userId: "user-1" }));
    expect(result.current.templatesOpen).toBe(false);
    expect(result.current.planTemplates).toEqual([]);
    expect(result.current.templatesLoading).toBe(false);
    expect(listPlanTemplatesMock).not.toHaveBeenCalled();
  });

  it("does not fetch when opened with no signed-in user", () => {
    const { result } = renderHook(() => usePlannerTemplates({ userId: null }));
    act(() => {
      result.current.setTemplatesOpen(true);
    });
    expect(listPlanTemplatesMock).not.toHaveBeenCalled();
    expect(result.current.templatesLoading).toBe(false);
  });

  it("opening the sheet fetches templates and populates the list", async () => {
    const { result } = renderHook(() => usePlannerTemplates({ userId: "user-1" }));
    act(() => {
      result.current.setTemplatesOpen(true);
    });
    expect(result.current.templatesLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.templatesLoading).toBe(false);
    });
    expect(listPlanTemplatesMock).toHaveBeenCalledWith({}, "user-1");
    expect(result.current.planTemplates).toEqual([TEMPLATE]);
  });

  it("exposes raw setters — the onSave/onApply/onDelete hydration path", () => {
    const { result } = renderHook(() => usePlannerTemplates({ userId: "user-1" }));
    act(() => {
      result.current.setPlanTemplates([TEMPLATE]);
    });
    expect(result.current.planTemplates).toEqual([TEMPLATE]);
    act(() => {
      result.current.setPlanTemplates((prev) => prev.filter((t) => t.id !== TEMPLATE.id));
    });
    expect(result.current.planTemplates).toEqual([]);
    act(() => {
      result.current.setTemplatesOpen(false);
    });
    expect(result.current.templatesOpen).toBe(false);
  });

  it("a generic fetch error shows a labelled alert and leaves the list untouched", async () => {
    listPlanTemplatesMock.mockResolvedValueOnce({ templates: [], error: "permission denied" });
    const { result } = renderHook(() => usePlannerTemplates({ userId: "user-1" }));
    act(() => {
      result.current.setTemplatesOpen(true);
    });
    await waitFor(() => {
      expect(result.current.templatesLoading).toBe(false);
    });
    expect(alertSpy).toHaveBeenCalledWith(
      "Templates",
      "Could not load templates: permission denied",
      expect.any(Array),
    );
    expect(result.current.planTemplates).toEqual([]);
  });

  it("a network-shaped error gets the friendlier offline message", async () => {
    listPlanTemplatesMock.mockResolvedValueOnce({ templates: [], error: "Network request failed" });
    const { result } = renderHook(() => usePlannerTemplates({ userId: "user-1" }));
    act(() => {
      result.current.setTemplatesOpen(true);
    });
    await waitFor(() => {
      expect(result.current.templatesLoading).toBe(false);
    });
    expect(alertSpy).toHaveBeenCalledWith(
      "Templates",
      "Couldn't reach Sloe. Check your connection and try again.",
      expect.any(Array),
    );
  });

  it("Cancel on the error alert closes the sheet", async () => {
    listPlanTemplatesMock.mockResolvedValueOnce({ templates: [], error: "boom" });
    const { result } = renderHook(() => usePlannerTemplates({ userId: "user-1" }));
    act(() => {
      result.current.setTemplatesOpen(true);
    });
    await waitFor(() => {
      expect(result.current.templatesLoading).toBe(false);
    });
    const buttons = alertSpy.mock.calls[0][2] as { text?: string; onPress?: () => void }[];
    const cancel = buttons.find((b) => b.text === "Cancel");
    act(() => {
      cancel?.onPress?.();
    });
    expect(result.current.templatesOpen).toBe(false);
  });

  it('"Try again" on the error alert re-fetches and can recover', async () => {
    listPlanTemplatesMock.mockResolvedValueOnce({ templates: [], error: "boom" });
    const { result } = renderHook(() => usePlannerTemplates({ userId: "user-1" }));
    act(() => {
      result.current.setTemplatesOpen(true);
    });
    await waitFor(() => {
      expect(result.current.templatesLoading).toBe(false);
    });
    expect(listPlanTemplatesMock).toHaveBeenCalledTimes(1);

    listPlanTemplatesMock.mockResolvedValueOnce({ templates: [TEMPLATE], error: null });
    const buttons = alertSpy.mock.calls[0][2] as { text?: string; onPress?: () => void }[];
    const tryAgain = buttons.find((b) => b.text === "Try again");
    act(() => {
      tryAgain?.onPress?.();
    });

    await waitFor(() => {
      expect(listPlanTemplatesMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(result.current.planTemplates).toEqual([TEMPLATE]);
    });
  });

  it("a stale response after the sheet closes does not write the list", async () => {
    let resolveFetch: (value: { templates: PlanTemplate[]; error: null }) => void = () => {};
    listPlanTemplatesMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const { result } = renderHook(() => usePlannerTemplates({ userId: "user-1" }));
    act(() => {
      result.current.setTemplatesOpen(true);
    });
    expect(result.current.templatesLoading).toBe(true);

    act(() => {
      result.current.setTemplatesOpen(false);
    });

    await act(async () => {
      resolveFetch({ templates: [TEMPLATE], error: null });
      await Promise.resolve();
    });

    // The effect's cleanup set `cancelled = true` on close, so the stale
    // resolution never writes `planTemplates`. `templatesLoading` is left
    // stale at `true` here — preserved verbatim from the pre-extraction
    // effect: the `.finally()` still runs, but its own `if (!cancelled)`
    // guard skips the reset once cancelled. Harmless in practice:
    // `<PlanTemplatesSheet>` is unmounted whenever `templatesOpen` is
    // false, so the stale flag has no render site until the sheet
    // reopens, at which point the effect fires again and sets it fresh.
    expect(result.current.planTemplates).toEqual([]);
  });
});
