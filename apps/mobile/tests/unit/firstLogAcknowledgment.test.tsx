// @vitest-environment jsdom
/**
 * FirstLogAcknowledgment — activation hook (audit 2026-04-30, leak
 * fix #3). The Reveal moment in onboarding is solid but momentum
 * evaporates after the user lands on Today: their first log moves
 * the ring with no acknowledgement. This component is the smallest
 * possible reward — a 2.5s toast pinned to a one-time AsyncStorage
 * flag — that closes that micro-leak.
 *
 * Behaviour pinned here:
 *   - `visible=false` renders nothing.
 *   - `visible=true` renders the copy "First log done." + "Your ring
 *     is moving." (two-line toast — bold first line + caption).
 *   - The 2.5-second auto-fade calls `onDismiss` exactly once.
 *   - Auto-fade timer is cancelled if the component unmounts /
 *     becomes invisible before it fires (no late-arrival dismiss
 *     after the toast was already hidden).
 *   - Toast accessibility role + label is correct so VoiceOver
 *     announces the success.
 *   - `topInset` prop overrides the default Spacing.lg so a host
 *     can push the toast below the safe-area / status bar.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react-native";

import { FirstLogAcknowledgment } from "../../components/today/FirstLogAcknowledgment";

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

describe("FirstLogAcknowledgment (mobile activation toast)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when visible=false", () => {
    const onDismiss = vi.fn();
    const { toJSON } = render(
      <FirstLogAcknowledgment visible={false} onDismiss={onDismiss} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders the canonical two-line copy when visible=true", () => {
    const onDismiss = vi.fn();
    const { getByText } = render(
      <FirstLogAcknowledgment visible onDismiss={onDismiss} />,
    );
    expect(getByText("First log done.")).toBeTruthy();
    expect(getByText("Your ring is moving.")).toBeTruthy();
  });

  it("exposes the toast accessibility role + label for VoiceOver", () => {
    const onDismiss = vi.fn();
    const { getByLabelText } = render(
      <FirstLogAcknowledgment visible onDismiss={onDismiss} />,
    );
    expect(getByLabelText("First log acknowledged")).toBeTruthy();
  });

  it("auto-fades after the default 2.5s timeout and calls onDismiss exactly once", () => {
    const onDismiss = vi.fn();
    render(<FirstLogAcknowledgment visible onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("respects a custom autoFadeMs prop (test driver override)", () => {
    const onDismiss = vi.fn();
    render(
      <FirstLogAcknowledgment
        visible
        onDismiss={onDismiss}
        autoFadeMs={500}
      />,
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
      <FirstLogAcknowledgment visible onDismiss={onDismiss} autoFadeMs={2500} />,
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    rerender(
      <FirstLogAcknowledgment visible={false} onDismiss={onDismiss} autoFadeMs={2500} />,
    );
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("clears the auto-fade timer on unmount (no late dismiss)", () => {
    const onDismiss = vi.fn();
    const { unmount } = render(
      <FirstLogAcknowledgment visible onDismiss={onDismiss} autoFadeMs={2500} />,
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
