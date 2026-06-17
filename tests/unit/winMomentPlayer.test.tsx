import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { WinMomentPlayer } from "../../src/app/components/ui/win-moment-player";

/**
 * ENG-901 — the web win-moment must render a real celebration, never the
 * old transparent dotLottie placeholder (which rendered BLANK).
 */
describe("ENG-901 — web WinMomentPlayer renders a real celebration", () => {
  it("renders an SVG ring + centre % + landmark label (not blank)", () => {
    const { container } = render(
      <WinMomentPlayer celebration="goal-hit" size={200} />,
    );
    expect(screen.getByTestId("win-moment-player")).toBeTruthy();
    expect(screen.getByTestId("win-moment-pct")).toBeTruthy();
    expect(screen.getByText("Goal hit")).toBeTruthy();
    // A concrete SVG ring renders — vs the prior transparent placeholder.
    expect(container.querySelector("svg circle")).toBeTruthy();
  });

  it("maps each celebration to its label", () => {
    const { rerender } = render(<WinMomentPlayer celebration="streak" />);
    expect(screen.getByText("Streak!")).toBeTruthy();
    rerender(<WinMomentPlayer celebration="log-confirm" />);
    expect(screen.getByText("Logged")).toBeTruthy();
  });

  it("ENG-901 M5 — streak milestone shows numeral + days consistent copy", () => {
    render(<WinMomentPlayer celebration="streak" milestone={7} />);
    expect(screen.getByTestId("win-moment-milestone")).toHaveTextContent("7");
    expect(screen.getByText("days consistent.")).toBeTruthy();
    expect(screen.queryByTestId("win-moment-pct")).toBeNull();
  });
});
