// @vitest-environment jsdom
/**
 * useToast (ENG-1344 first slice) — host-owned visibility/message/variant
 * state + auto-dismiss timer for the shared `<Toast>` primitive.
 *
 * Behaviour pinned here:
 *   - Initial state is hidden.
 *   - `showToast` makes it visible with the given message/variant/icon.
 *   - Auto-dismisses after the default 3000ms (or a per-call override).
 *   - Replace, not queue: calling `showToast` again while visible replaces
 *     the message immediately and resets the auto-dismiss clock — it does
 *     NOT stack a second pending dismiss on top of the first.
 *   - `dismissToast` hides immediately and cancels the pending timer.
 *   - The timer is cleared on unmount (no late state update).
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react-native";

import { useToast } from "../../hooks/useToast";
import type { LucideIcon } from "lucide-react-native";

void React;

const FakeIcon = (() => null) as unknown as LucideIcon;

describe("useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts hidden with no message", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.visible).toBe(false);
    expect(result.current.message).toBeNull();
  });

  it("showToast makes it visible with the given message and defaults variant to info", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("Saved");
    });
    expect(result.current.visible).toBe(true);
    expect(result.current.message).toBe("Saved");
    expect(result.current.variant).toBe("info");
  });

  it("respects a custom variant and icon", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("Logged", { variant: "success", icon: FakeIcon });
    });
    expect(result.current.variant).toBe("success");
    expect(result.current.icon).toBe(FakeIcon);
  });

  it("auto-dismisses after the default 3000ms", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("Saved");
    });
    expect(result.current.visible).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current.visible).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.visible).toBe(false);
  });

  it("respects a per-call durationMs override", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("Quick", { durationMs: 500 });
    });
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current.visible).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.visible).toBe(false);
  });

  it("respects the hook-level autoDismissMs default", () => {
    const { result } = renderHook(() => useToast({ autoDismissMs: 200 }));
    act(() => {
      result.current.showToast("Hook default");
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.visible).toBe(false);
  });

  it("replace, not queue: a second showToast while visible replaces the message and resets the clock", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("First", { durationMs: 1000 });
    });
    act(() => {
      vi.advanceTimersByTime(900);
    });
    // Still visible — replace with a new message before the first dismiss fires.
    act(() => {
      result.current.showToast("Second", { durationMs: 1000 });
    });
    expect(result.current.message).toBe("Second");
    expect(result.current.visible).toBe(true);
    // The FIRST toast's original 1000ms mark (only 100ms after the replace)
    // must NOT dismiss it — the clock reset with the replace.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.visible).toBe(true);
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(result.current.visible).toBe(false);
  });

  it("dismissToast hides immediately and cancels the pending timer", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("Dismiss me");
    });
    act(() => {
      result.current.dismissToast();
    });
    expect(result.current.visible).toBe(false);
    // No late flip back to visible when the original timer would have fired.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.visible).toBe(false);
  });

  it("clears the timer on unmount (no late state update / act warning)", () => {
    const { result, unmount } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("Unmount me");
    });
    unmount();
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(5000);
      });
    }).not.toThrow();
  });
});
