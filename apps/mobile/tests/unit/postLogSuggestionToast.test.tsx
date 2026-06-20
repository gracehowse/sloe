// @vitest-environment jsdom
/**
 * PostLogSuggestionToast — the calm post-log "what to eat next"
 * micro-moment (ENG-977). After an AI log commits, this transient toast
 * surfaces the shared `buildPostLogSuggestion` line so the user is bridged
 * from log → suggestion (the coaching layer Cal AI lacks).
 *
 * Behaviour pinned here:
 *   - `visible=false` (or a null line) renders nothing.
 *   - `visible=true` with a line renders that exact line (microcopy parity
 *     with the web sonner toast — the helper builds one string for both).
 *   - The auto-fade calls `onDismiss` exactly once after the timeout.
 *   - The timer is cancelled on unmount / visibility flip (no late dismiss).
 *   - The toast exposes its line as the accessibility label for VoiceOver.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react-native";

import { PostLogSuggestionToast } from "../../components/today/PostLogSuggestionToast";

void React;

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    card: "#f7f7f7",
    border: "#eee",
    cardBorder: "#eee",
    inputBg: "#f0f0f0",
  }),
}));

const LINE = "Logged. ~640 kcal left — dinner could be Chicken traybake.";

describe("PostLogSuggestionToast (mobile post-log nudge)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when visible=false", () => {
    const { toJSON } = render(
      <PostLogSuggestionToast visible={false} line={LINE} onDismiss={vi.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders nothing when the line is null even if visible", () => {
    const { toJSON } = render(
      <PostLogSuggestionToast visible line={null} onDismiss={vi.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders the exact suggestion line when visible (web↔mobile microcopy parity)", () => {
    const { getByText } = render(
      <PostLogSuggestionToast visible line={LINE} onDismiss={vi.fn()} />,
    );
    expect(getByText(LINE)).toBeTruthy();
  });

  it("exposes the line as the accessibility label for VoiceOver", () => {
    const { getByLabelText } = render(
      <PostLogSuggestionToast visible line={LINE} onDismiss={vi.fn()} />,
    );
    expect(getByLabelText(LINE)).toBeTruthy();
  });

  it("auto-fades after the default 4s timeout and calls onDismiss exactly once", () => {
    const onDismiss = vi.fn();
    render(<PostLogSuggestionToast visible line={LINE} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("respects a custom autoFadeMs prop", () => {
    const onDismiss = vi.fn();
    render(
      <PostLogSuggestionToast visible line={LINE} onDismiss={onDismiss} autoFadeMs={500} />,
    );
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("clears the auto-fade timer when visibility flips false (no late dismiss)", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <PostLogSuggestionToast visible line={LINE} onDismiss={onDismiss} autoFadeMs={4000} />,
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    rerender(
      <PostLogSuggestionToast visible={false} line={LINE} onDismiss={onDismiss} autoFadeMs={4000} />,
    );
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
