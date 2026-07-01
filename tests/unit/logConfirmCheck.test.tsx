/**
 * LogConfirmCheck (web, ENG-722) — the calm log-confirm checkmark overlay.
 *
 * Pins the render contract: renders the sage check disc while `visible`, nothing
 * when not, and re-mounts (new key) on a fresh rising edge so a rapid second log
 * replays the animation from frame 0. The flag + reduce-motion gates live in the
 * caller (`useLogConfirmCheck`, tested separately) — this component is a pure
 * render of its `visible` prop.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { LogConfirmCheck } from "../../src/app/components/suppr/log-confirm-check";

describe("LogConfirmCheck (web)", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(<LogConfirmCheck visible={false} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("log-confirm-check")).toBeNull();
  });

  it("renders the check overlay when visible", () => {
    render(<LogConfirmCheck visible />);
    const overlay = screen.getByTestId("log-confirm-check");
    expect(overlay).toBeDefined();
    // The animated disc carries the keyframe class; the glyph is aria-hidden.
    expect(overlay.querySelector(".log-confirm-check")).not.toBeNull();
    expect(overlay.getAttribute("aria-hidden")).toBe("true");
  });

  it("is pointer-events-none so it never blocks taps on the ring beneath", () => {
    render(<LogConfirmCheck visible />);
    const overlay = screen.getByTestId("log-confirm-check");
    expect(overlay.className).toContain("pointer-events-none");
  });

  it("re-mounts the animated disc (new key) on a fresh rising edge", () => {
    const { rerender } = render(<LogConfirmCheck visible />);
    const first = screen
      .getByTestId("log-confirm-check")
      .querySelector(".log-confirm-check");
    // Off then on again = a second log → the disc element should be a NEW node
    // (React remounts on the bumped key) so the CSS animation restarts.
    rerender(<LogConfirmCheck visible={false} />);
    rerender(<LogConfirmCheck visible />);
    const second = screen
      .getByTestId("log-confirm-check")
      .querySelector(".log-confirm-check");
    expect(second).not.toBe(first);
  });
});
