import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OptionCard } from "../../src/app/components/ui/option-card";

void React;

/**
 * Tests for the `OptionCard` selection primitive (Phase 1 of the
 * onboarding redesign). Used by Goal / Sex / Activity / Diet steps and
 * any flow that picks one or many from a small list.
 *
 * Locks in:
 *   - Native `<button>` semantics (keyboard + screen reader work without
 *     extra ARIA wiring on the consumer).
 *   - `aria-pressed` reflects the `selected` prop so multi-select
 *     accessibility tools see toggled state.
 *   - Default trailing slot is the check/uncheck radio. Passing
 *     `trailing={null}` removes it (chip-style multi-select shape).
 *   - Selected state surfaces via `data-selected` so visual-regression
 *     tests can assert on it without colour matching.
 */

describe("OptionCard", () => {
  it("renders title and subtitle text", () => {
    render(<OptionCard title="Lose fat" subtitle="Gradual deficit, protein-first" />);
    expect(screen.getByText("Lose fat")).toBeInTheDocument();
    expect(screen.getByText("Gradual deficit, protein-first")).toBeInTheDocument();
  });

  it("uses a native <button> so keyboard activation works for free", () => {
    render(<OptionCard title="Maintain" />);
    const btn = screen.getByRole("button", { name: "Maintain" });
    expect(btn.tagName.toLowerCase()).toBe("button");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("calls onClick when activated", () => {
    const onClick = vi.fn();
    render(<OptionCard title="Recomp" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Recomp" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("reflects the selected state via aria-pressed and data-selected", () => {
    const { rerender } = render(<OptionCard title="Goal" />);
    const btn = screen.getByRole("button", { name: "Goal" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveAttribute("data-selected", "false");
    rerender(<OptionCard title="Goal" selected />);
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveAttribute("data-selected", "true");
  });

  it("renders a default check indicator when trailing is omitted", () => {
    const { container } = render(<OptionCard title="Goal" selected />);
    // Lucide Check renders an <svg>; assert one is present in the trailing slot.
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("suppresses the trailing slot when trailing={null}", () => {
    const { container } = render(<OptionCard title="Goal" trailing={null} />);
    expect(container.querySelectorAll("svg").length).toBe(0);
  });

  it("renders the icon slot when provided", () => {
    render(
      <OptionCard
        title="With icon"
        icon={<span data-testid="custom-icon">★</span>}
      />,
    );
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });
});
