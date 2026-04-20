import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SupprMark, SupprWordmark } from "../../src/app/components/ui/suppr-mark";

void React;

/**
 * Tests for the `SupprMark` brand-mark primitive (Phase 1 of the
 * onboarding redesign — see `docs/decisions/2026-04-19-onboarding-redesign-scope.md`).
 *
 * Locks in the invariants from `docs/ux/brand-guidelines.md`:
 *   - Mark is always rendered with the brand primary background and a
 *     white "S" — never themed away from white. (The dark-mode lift to
 *     a brighter blue happens via `--primary` in `theme.css`.)
 *   - Wordmark composes Mark + the Suppr label with the canonical
 *     spacing (gap-2.5) so both surfaces stay in sync.
 */

describe("SupprMark", () => {
  it("renders an SVG with role=img and a brand aria-label", () => {
    render(<SupprMark />);
    const svg = screen.getByRole("img", { name: "Suppr" });
    expect(svg.tagName.toLowerCase()).toBe("svg");
  });

  it("respects the size prop on width and height", () => {
    render(<SupprMark size={48} />);
    const svg = screen.getByRole("img", { name: "Suppr" });
    expect(svg.getAttribute("width")).toBe("48");
    expect(svg.getAttribute("height")).toBe("48");
  });

  it("draws a rounded rect with the brand primary as the background fill", () => {
    const { container } = render(<SupprMark />);
    const rect = container.querySelector("rect");
    expect(rect).not.toBeNull();
    // The rect must reference the CSS variable so dark-mode swaps the
    // hex automatically — never a hardcoded hex.
    expect(rect?.getAttribute("fill")).toBe("var(--primary)");
    expect(rect?.getAttribute("rx")).toBe("8");
  });

  it("renders the white 'S' letter on top", () => {
    const { container } = render(<SupprMark />);
    const text = container.querySelector("text");
    expect(text?.textContent).toBe("S");
    expect(text?.getAttribute("fill")).toBe("#ffffff");
  });
});

describe("SupprWordmark", () => {
  it("composes the Mark with the 'Suppr' word", () => {
    render(<SupprWordmark />);
    expect(screen.getByText("Suppr")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Suppr" })).toBeInTheDocument();
  });

  it("scales the wordmark text proportionally to the size prop", () => {
    render(<SupprWordmark size={40} />);
    const word = screen.getByText("Suppr");
    // 0.64 * 40 = 25.6 → rounded to 26
    expect(word).toHaveStyle({ fontSize: "26px" });
  });
});
