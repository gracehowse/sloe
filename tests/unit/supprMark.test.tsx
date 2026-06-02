import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  SupprMark,
  SupprPlateMark,
  SupprPlateWordmark,
  SupprWordmark,
} from "../../src/app/components/ui/suppr-mark";

void React;

// Redesign 2026 ships default-ON (`REDESIGN_DEFAULT_ON` in `track.ts`); the
// `design_system_brandmark` on-state swaps the plate mark. This file pins the
// pre-redesign monochrome plate mark, so force the design-system flags OFF via
// the `window.__SUPPR_FORCE_FLAGS__` hook `track.ts` honours (explicit `false`
// wins over default-on). On-state is covered by `MarkBrandmarkOn` in the story.
beforeEach(() => {
  (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ = {
    design_system_elevation: false,
    design_system_colours: false,
    design_system_brandmark: false,
    design_system_icons: false,
  };
});
afterEach(() => {
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__;
});

/**
 * Tests for the `SupprMark` brand-mark primitive (Phase 1 of the
 * onboarding redesign — see `docs/decisions/2026-04-19-onboarding-redesign-scope.md`).
 *
 * Locks in the monochrome plate mark (`--brand-mark-bg` / `--brand-mark-ring`)
 * from `docs/ux/brand-guidelines.md` — not the legacy blue primary tile.
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

  it("draws a rounded rect with brand-mark tokens (cream bg, ink ring)", () => {
    const { container } = render(<SupprMark />);
    const rect = container.querySelector("rect");
    expect(rect).not.toBeNull();
    expect(rect?.getAttribute("fill")).toBe("var(--brand-mark-bg)");
    expect(rect?.getAttribute("rx")).toBe("8");
  });

  it("renders the 'S' letter using --brand-mark-ring", () => {
    const { container } = render(<SupprMark />);
    const text = container.querySelector("text");
    expect(text?.textContent).toBe("S");
    expect(text?.getAttribute("fill")).toBe("var(--brand-mark-ring)");
  });
});

describe("SupprPlateMark", () => {
  it("renders an SVG with role=img and a brand aria-label", () => {
    render(<SupprPlateMark />);
    const svg = screen.getByRole("img", { name: "Suppr" });
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg).toHaveAttribute("data-slot", "suppr-plate-mark");
  });
});

describe("SupprPlateWordmark", () => {
  it("composes the plate mark with the Suppr word", () => {
    render(<SupprPlateWordmark />);
    expect(screen.getByText("Suppr")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Suppr" })).toBeInTheDocument();
  });
});

describe("SupprWordmark", () => {
  it("composes the Mark with the 'Suppr' word", () => {
    render(<SupprWordmark />);
    expect(screen.getByText("Suppr")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Suppr" })).toBeInTheDocument();
  });

  it("scales the wordmark text at the 0.72 ratio to match mobile (ENG-797 parity)", () => {
    render(<SupprWordmark size={40} />);
    const word = screen.getByText("Suppr");
    // Web↔mobile parity: mobile SupprMark.tsx uses Math.round(size * 0.72).
    // 0.72 * 40 = 28.8 → rounded to 29.
    expect(word).toHaveStyle({ fontSize: "29px" });
  });

  it("matches the canonical plate wordmark ratio at the default size", () => {
    // Both wordmark variants must share the 0.72 multiplier so the
    // legacy and canonical brand paths stay pixel-identical to mobile.
    const { container: legacy } = render(<SupprWordmark size={28} />);
    const { container: plate } = render(<SupprPlateWordmark size={28} />);
    // 0.72 * 28 = 20.16 → rounded to 20.
    const legacyWord = legacy.querySelector('[data-slot="suppr-wordmark"] span');
    const plateWord = plate.querySelector('[data-slot="suppr-plate-wordmark"] span');
    expect(legacyWord).toHaveStyle({ fontSize: "20px" });
    expect(plateWord).toHaveStyle({ fontSize: "20px" });
  });
});
