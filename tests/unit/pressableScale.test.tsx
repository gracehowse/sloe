/**
 * PressableScale (web) — production-design-spec §1.1 press-feedback primitive.
 *
 * Pins:
 *   - children render
 *   - onClick fires on click
 *   - applies the canonical scale class for the default scaleTo (0.97)
 *   - applies the canonical scale class for an alternate scaleTo (0.94)
 *   - includes the focus-visible ring class
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { PressableScale } from "../../src/app/components/ui/pressable-scale";

describe("PressableScale (web)", () => {
  it("renders children", () => {
    render(<PressableScale onClick={() => {}}>tap me</PressableScale>);
    expect(screen.getByText("tap me")).toBeDefined();
  });

  it("invokes onClick on click", () => {
    const onClick = vi.fn();
    render(<PressableScale onClick={onClick}>tap me</PressableScale>);
    fireEvent.click(screen.getByText("tap me"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies the canonical active:scale-[0.97] class by default", () => {
    render(<PressableScale onClick={() => {}}>tap me</PressableScale>);
    const btn = screen.getByText("tap me");
    expect(btn.className).toMatch(/active:scale-\[0\.97\]/);
  });

  it("applies the active:scale-[0.94] class when scaleTo=0.94", () => {
    render(
      <PressableScale onClick={() => {}} scaleTo={0.94}>
        tap me
      </PressableScale>,
    );
    const btn = screen.getByText("tap me");
    expect(btn.className).toMatch(/active:scale-\[0\.94\]/);
  });

  it("includes the focus-visible ring class", () => {
    render(<PressableScale onClick={() => {}}>tap me</PressableScale>);
    const btn = screen.getByText("tap me");
    expect(btn.className).toMatch(/focus-visible:ring-2/);
  });

  it("renders as a button by default (type=button)", () => {
    render(<PressableScale onClick={() => {}}>tap me</PressableScale>);
    const btn = screen.getByText("tap me") as HTMLButtonElement;
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.type).toBe("button");
  });
});
