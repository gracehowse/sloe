// @vitest-environment jsdom
/**
 * WinMomentPlayer — the REAL code celebration (Design Direction 2026,
 * 2026-06-01; `docs/decisions/2026-06-01-design-direction-2026.md`).
 *
 * The placeholder used to be a 1-frame TRANSPARENT Lottie that rendered
 * nothing. It is now a code-driven gold celebration (Reanimated + SVG, no art
 * asset). These pins protect the user-observable contract:
 *   - the player mounts and renders a visible centre hero (% + landmark label)
 *     in the dedicated win GOLD token — NOT a transparent no-op,
 *   - it draws the gold-gradient ring (the calorie ring "closing"),
 *   - it fires `onComplete` exactly once, after the ~700ms celebration window,
 *     so the caller can unmount it,
 *   - per-celebration label copy is correct (goal-hit / streak / log-confirm).
 *
 * The once-per-day + flag gate + success haptic live in `use-win-moment` (the
 * caller), not this primitive — so they're tested there, not here.
 */
import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react-native";

import { WinMomentPlayer } from "../../components/ui/WinMomentPlayer";
import { Accent } from "../../constants/theme";

describe("WinMomentPlayer (mobile code celebration)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders a visible centre hero — NOT a transparent no-op", () => {
    const { getByTestId } = render(<WinMomentPlayer celebration="goal-hit" />);
    // The player wrapper + the % hero both exist and are real nodes.
    expect(getByTestId("win-moment-player")).toBeTruthy();
    expect(getByTestId("win-moment-pct")).toBeTruthy();
  });

  it("paints the centre hero in the dedicated win GOLD token", () => {
    const { getByTestId } = render(<WinMomentPlayer celebration="goal-hit" />);
    const pct = getByTestId("win-moment-pct");
    // Flatten the style array RN passes through.
    const style = Array.isArray(pct.props.style)
      ? Object.assign({}, ...pct.props.style)
      : pct.props.style;
    expect(style.color).toBe(Accent.win);
    expect(Accent.win).toBe("#C99A22"); // gold, not the retired amber
  });

  it("fires onComplete exactly once after the celebration window", () => {
    const onComplete = vi.fn();
    render(<WinMomentPlayer celebration="goal-hit" onComplete={onComplete} />);
    // Nothing before the window elapses.
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(720); // > CELEBRATION_MS (700)
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does not double-fire onComplete on further ticks", () => {
    const onComplete = vi.fn();
    render(<WinMomentPlayer celebration="streak" onComplete={onComplete} />);
    act(() => {
      vi.advanceTimersByTime(700);
      vi.advanceTimersByTime(700);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("shows the right landmark label per celebration", () => {
    const goal = render(<WinMomentPlayer celebration="goal-hit" />);
    expect(goal.getByText("Goal hit")).toBeTruthy();
    goal.unmount();

    const streak = render(<WinMomentPlayer celebration="streak" />);
    expect(streak.getByText("Streak!")).toBeTruthy();
    streak.unmount();

    const confirm = render(<WinMomentPlayer celebration="log-confirm" />);
    expect(confirm.getByText("Logged")).toBeTruthy();
  });

  it("clears its completion timer on unmount (no fire after unmount)", () => {
    const onComplete = vi.fn();
    const { unmount } = render(
      <WinMomentPlayer celebration="goal-hit" onComplete={onComplete} />,
    );
    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });
});
