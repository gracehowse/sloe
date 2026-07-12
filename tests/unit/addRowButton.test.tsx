/**
 * @vitest-environment jsdom
 */
/**
 * AddRowButton (web) — the ONE add-row / AddControl grammar (ENG-1375 S4,
 * AddControl ruling in `docs/decisions/2026-07-10-chip-grammar-soft-tint.md`):
 * quiet-fill pill — `bg-fill-quiet`, radius 12, Plus glyph + primary-solid
 * semibold label, full-width in-card. Dashed borders are upload dropzones
 * ONLY. Mobile mirror test: `apps/mobile/tests/unit/addRowButton.test.tsx`.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AddRowButton } from "../../src/app/components/ui/add-row-button";

describe("AddRowButton (AddControl grammar)", () => {
  it("renders the quiet-fill pill — bg-fill-quiet, radius 12, full-width, semibold primary-solid label, no border", () => {
    render(<AddRowButton label="Add food" data-testid="add" />);
    const btn = screen.getByTestId("add");
    expect(btn.className).toContain("bg-fill-quiet");
    expect(btn.className).toContain("rounded-[12px]");
    expect(btn.className).toContain("w-full");
    expect(btn.className).toContain("font-semibold");
    expect(btn.className).toContain("text-primary-solid");
    // NO border — dashed edges are upload dropzones only.
    expect(btn.className).not.toMatch(/\bborder\b/);
    expect(btn.className).not.toContain("dashed");
  });

  it("fires onClick", () => {
    const onClick = vi.fn();
    render(<AddRowButton label="Add food" onClick={onClick} data-testid="add" />);
    fireEvent.click(screen.getByTestId("add"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled blocks the click and dims", () => {
    const onClick = vi.fn();
    render(
      <AddRowButton label="Add food" onClick={onClick} disabled data-testid="add" />,
    );
    const btn = screen.getByTestId("add");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
    expect(btn.className).toContain("opacity-50");
  });

  it("loading disables, marks aria-busy, and swaps the glyph for a spinner", () => {
    const onClick = vi.fn();
    render(
      <AddRowButton label="Add food" onClick={onClick} loading data-testid="add" />,
    );
    const btn = screen.getByTestId("add");
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
    expect(btn.querySelector(".animate-spin")).not.toBeNull();
  });

  it("accepts a leading-glyph override (the Add-meal dialog search hand-off)", () => {
    render(
      <AddRowButton
        label="Search foods"
        icon={<span data-testid="custom-glyph" />}
        data-testid="add"
      />,
    );
    expect(screen.getByTestId("custom-glyph")).toBeTruthy();
  });
});
