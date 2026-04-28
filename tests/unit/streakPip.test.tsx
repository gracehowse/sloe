/**
 * streakPip — web parity to the mobile <StreakPip> primitive.
 *
 * Authority: D-2026-04-27-07 (streak as pip).
 * Source: src/app/components/suppr/streak-pip.tsx
 *
 * The pip replaces the demoted streak ribbon. Pinning the rendering
 * rules (zero-day default, singular vs plural, NaN clamping) here
 * means a future rewrite that drops the day count or breaks the
 * accessibility label fails CI before reaching mobile-web.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { StreakPip } from "../../src/app/components/suppr/streak-pip";

describe("StreakPip (web)", () => {
  it("renders 'Start your streak' at zero days", () => {
    render(<StreakPip days={0} />);
    expect(screen.getByText("Start your streak")).toBeDefined();
  });

  it("renders '1-day streak' at one day", () => {
    render(<StreakPip days={1} />);
    expect(screen.getByText("1-day streak")).toBeDefined();
  });

  it("renders 'N-day streak' at two or more days (mobile parity)", () => {
    render(<StreakPip days={5} />);
    expect(screen.getByText("5-day streak")).toBeDefined();
  });

  it("clamps non-finite or negative inputs to 0 (defensive)", () => {
    const { rerender } = render(<StreakPip days={Number.NaN} />);
    expect(screen.getByText("Start your streak")).toBeDefined();

    rerender(<StreakPip days={-3} />);
    expect(screen.getByText("Start your streak")).toBeDefined();
  });

  it("exposes a default accessibility label tied to the day count", () => {
    render(<StreakPip days={7} />);
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe("7-day logging streak");
  });

  it("respects an override accessibility label when provided", () => {
    render(<StreakPip days={3} ariaLabel="Three-day streak — keep it up" />);
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Three-day streak — keep it up");
  });

  it("toggles the active styling at the 2-day threshold", () => {
    const { rerender } = render(<StreakPip days={1} />);
    const oneDay = screen.getByRole("status");
    expect(oneDay.className).toMatch(/text-muted-foreground/);

    rerender(<StreakPip days={2} />);
    const twoDay = screen.getByRole("status");
    expect(twoDay.className).toMatch(/text-primary/);
  });
});
