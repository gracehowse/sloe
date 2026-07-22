/**
 * useLogSessionTray — the shared tray state hook (append / undo / reset +
 * in-flight guard). Spec: `docs/specs/2026-07-21-log-session-tray.md` §7.1.
 *
 * The in-flight disable + double-submit guard live HERE (the hook owns
 * `pendingUndoIds`); the components just render the disabled state from that
 * prop. This is the real "in-flight" test the render harnesses defer to.
 */
import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useLogSessionTray } from "@/lib/nutrition/useLogSessionTray";
import type { LogSessionTrayItem } from "@/lib/nutrition/logSessionTray";

function item(partial: Partial<LogSessionTrayItem> = {}): LogSessionTrayItem {
  return {
    mealId: "m1", title: "Oats", kcal: 100,
    protein: 5, carbs: 20, fat: 2, slot: "Breakfast", ...partial,
  };
}

describe("useLogSessionTray", () => {
  it("append pushes items in order", () => {
    const { result } = renderHook(() => useLogSessionTray({ onRemoveItem: () => {} }));
    act(() => result.current.append(item({ mealId: "a" })));
    act(() => result.current.append(item({ mealId: "b" })));
    expect(result.current.items.map((i) => i.mealId)).toEqual(["a", "b"]);
  });

  it("undo removes the item via the host removal path and drops it from state", async () => {
    const onRemoveItem = vi.fn();
    const { result } = renderHook(() => useLogSessionTray({ onRemoveItem }));
    act(() => result.current.append(item({ mealId: "a" })));
    act(() => result.current.append(item({ mealId: "b" })));
    await act(async () => {
      await result.current.undo(item({ mealId: "a" }));
    });
    expect(onRemoveItem).toHaveBeenCalledWith("a");
    expect(result.current.items.map((i) => i.mealId)).toEqual(["b"]);
  });

  it("marks the item pending while its removal is in flight, then clears it", async () => {
    let release: () => void = () => {};
    const onRemoveItem = vi.fn(() => new Promise<void>((r) => { release = r; }));
    const { result } = renderHook(() => useLogSessionTray({ onRemoveItem }));
    act(() => result.current.append(item({ mealId: "a" })));

    let undoPromise: Promise<void>;
    act(() => {
      undoPromise = result.current.undo(item({ mealId: "a" }));
    });
    // In flight → pending.
    await waitFor(() => expect(result.current.pendingUndoIds).toContain("a"));
    // Still present until the removal settles.
    expect(result.current.items.map((i) => i.mealId)).toEqual(["a"]);

    await act(async () => {
      release();
      await undoPromise;
    });
    expect(result.current.pendingUndoIds).not.toContain("a");
    expect(result.current.items).toEqual([]);
  });

  it("guards against a double-submit for the same in-flight item", async () => {
    let release: () => void = () => {};
    const onRemoveItem = vi.fn(() => new Promise<void>((r) => { release = r; }));
    const { result } = renderHook(() => useLogSessionTray({ onRemoveItem }));
    act(() => result.current.append(item({ mealId: "a" })));

    let first: Promise<void>;
    act(() => {
      first = result.current.undo(item({ mealId: "a" }));
    });
    // Second call while the first is in flight is a no-op.
    await act(async () => {
      await result.current.undo(item({ mealId: "a" }));
    });
    expect(onRemoveItem).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
      await first;
    });
  });

  it("reset clears items + pending without un-committing anything", () => {
    const onRemoveItem = vi.fn();
    const { result } = renderHook(() => useLogSessionTray({ onRemoveItem }));
    act(() => result.current.append(item({ mealId: "a" })));
    act(() => result.current.append(item({ mealId: "b" })));
    act(() => result.current.reset());
    expect(result.current.items).toEqual([]);
    expect(result.current.pendingUndoIds).toEqual([]);
    // reset is presentation-only — it NEVER calls the removal path.
    expect(onRemoveItem).not.toHaveBeenCalled();
  });
});
