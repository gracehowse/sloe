import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  RulerSlider,
  formatImperialHeightInches,
  parseImperialHeightInches,
} from "../../src/app/components/suppr/ruler-slider";

void React;

/**
 * Tests for the `RulerSlider` iOS-style picker (Phase 1 of the
 * onboarding redesign). Used by Height + Weight steps. Drag interaction
 * is covered by `apps/mobile/tests/e2e/onboarding.test.ts` (out of
 * scope here — RTL's pointer events on a canvas don't replicate the
 * pointer-capture loop reliably).
 *
 * What this file locks in:
 *   - Number readout reflects the value, formatted via decimals or the
 *     custom `format` callback.
 *   - The slider renders with `role="slider"` plus full aria-value*
 *     attributes so assistive tech sees the range.
 *   - Keyboard nudges fire onChange with the snapped neighbour.
 *   - Tap-to-edit swaps the readout for an input; Enter commits.
 *   - Imperial helpers (`formatImperialHeightInches`,
 *     `parseImperialHeightInches`) round-trip cleanly.
 */

describe("RulerSlider", () => {
  it("renders the value with the unit suffix", () => {
    render(
      <RulerSlider value={170} onChange={() => {}} min={140} max={210} unit="cm" />,
    );
    expect(screen.getByText("170")).toBeInTheDocument();
    expect(screen.getByText("cm")).toBeInTheDocument();
  });

  it("respects custom format() and hides the unit when format is set", () => {
    render(
      <RulerSlider
        value={70}
        onChange={() => {}}
        min={48}
        max={84}
        unit="ignored"
        format={(v) => `5′ ${v - 60}″`}
      />,
    );
    expect(screen.getByText("5′ 10″")).toBeInTheDocument();
    expect(screen.queryByText("ignored")).toBeNull();
  });

  it("exposes the slider with full aria-value* attributes", () => {
    render(
      <RulerSlider
        value={70}
        onChange={() => {}}
        min={50}
        max={120}
        unit="kg"
        ariaLabel="Weight"
      />,
    );
    const slider = screen.getByRole("slider", { name: "Weight" });
    expect(slider).toHaveAttribute("aria-valuenow", "70");
    expect(slider).toHaveAttribute("aria-valuemin", "50");
    expect(slider).toHaveAttribute("aria-valuemax", "120");
  });

  it("nudges the value on ArrowRight / ArrowLeft", () => {
    const onChange = vi.fn();
    render(
      <RulerSlider value={170} onChange={onChange} min={140} max={210} step={1} unit="cm" />,
    );
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(171);
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith(169);
  });

  it("clamps to min and max via Home / End", () => {
    const onChange = vi.fn();
    render(
      <RulerSlider value={170} onChange={onChange} min={140} max={210} unit="cm" />,
    );
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(140);
    fireEvent.keyDown(slider, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(210);
  });

  it("opens the editor when the readout button is tapped, commits on Enter", () => {
    const onChange = vi.fn();
    render(
      <RulerSlider value={170} onChange={onChange} min={140} max={210} unit="cm" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /edit value/i }));
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "184" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(184);
  });
});

describe("imperial height helpers", () => {
  it("formats total inches as ft′ in″", () => {
    expect(formatImperialHeightInches(70)).toBe("5′ 10″");
    expect(formatImperialHeightInches(60)).toBe("5′ 0″");
    expect(formatImperialHeightInches(72)).toBe("6′ 0″");
  });

  it("parses common imperial entry shapes back to total inches", () => {
    expect(parseImperialHeightInches("5'10\"")).toBe(70);
    expect(parseImperialHeightInches("5 10")).toBe(70);
    expect(parseImperialHeightInches("5ft 10in")).toBe(70);
    expect(parseImperialHeightInches("70")).toBe(70);
  });
});
