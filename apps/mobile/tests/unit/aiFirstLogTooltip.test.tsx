// @vitest-environment jsdom
/**
 * AiFirstLogTooltip — Phase 5 (2026-04-30) replacement for the
 * per-day "Includes N AI-estimated meals" sentinel that used to render
 * inside `TodayHero`. customer-lens flagged the daily caption as a
 * defensive disclaimer that contradicted the 2026-04-27 strategic
 * direction (macro-tracker-first, not AI-first). The new model: one
 * tooltip below the user's first AI-sourced meal row ever, then never
 * again.
 *
 * Behaviour pinned here:
 *   - `visible=false` renders nothing.
 *   - `visible=true` renders the canonical copy + an accessible
 *     dismiss button.
 *   - X tap calls `onDismiss` exactly once.
 *   - The 6-second auto-fade calls `onDismiss` exactly once.
 *   - Auto-fade timer is cancelled if the component unmounts /
 *     becomes invisible before it fires (no late-arrival dismiss).
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, act } from "@testing-library/react-native";

import { AiFirstLogTooltip } from "../../components/today/AiFirstLogTooltip";

void React;

describe("AiFirstLogTooltip (mobile)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when visible=false", () => {
    const onDismiss = vi.fn();
    const { toJSON } = render(
      <AiFirstLogTooltip visible={false} onDismiss={onDismiss} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders the canonical copy when visible=true", () => {
    const onDismiss = vi.fn();
    const { getByText } = render(
      <AiFirstLogTooltip visible onDismiss={onDismiss} />,
    );
    expect(
      getByText("We fill in nutrition for photos & voice. Tap to verify or edit."),
    ).toBeTruthy();
  });

  it("exposes accessibility labels for the bubble and dismiss button", () => {
    const onDismiss = vi.fn();
    const { getByLabelText } = render(
      <AiFirstLogTooltip visible onDismiss={onDismiss} />,
    );
    expect(getByLabelText("AI estimation explanation")).toBeTruthy();
    expect(getByLabelText("Dismiss tooltip")).toBeTruthy();
  });

  it("calls onDismiss exactly once when the X is tapped", () => {
    const onDismiss = vi.fn();
    const { getByLabelText } = render(
      <AiFirstLogTooltip visible onDismiss={onDismiss} />,
    );
    fireEvent.press(getByLabelText("Dismiss tooltip"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("auto-fades after the timeout and calls onDismiss exactly once", () => {
    const onDismiss = vi.fn();
    render(
      <AiFirstLogTooltip visible onDismiss={onDismiss} autoFadeMs={6000} />,
    );
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("clears the auto-fade timer when visibility flips false before it fires", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <AiFirstLogTooltip visible onDismiss={onDismiss} autoFadeMs={6000} />,
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    rerender(
      <AiFirstLogTooltip visible={false} onDismiss={onDismiss} autoFadeMs={6000} />,
    );
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("clears the auto-fade timer on unmount (no late dismiss)", () => {
    const onDismiss = vi.fn();
    const { unmount } = render(
      <AiFirstLogTooltip visible onDismiss={onDismiss} autoFadeMs={6000} />,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
