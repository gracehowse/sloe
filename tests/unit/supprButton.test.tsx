/**
 * supprButton (web) — pins the shared CTA primitive.
 *
 * Grammar (`docs/decisions/2026-06-12-button-system-solid-primary.md`):
 *   - primary → SOLID aubergine fill (bg-primary-solid), WHITE label,
 *     rounded-full pill, NO border, NO shadow
 *   - ghost   → transparent, NO border, plum label (text-primary-solid)
 *   - disabled / loading block onClick (no double-submit); loading shows spinner
 *
 * Mirrors the mobile pin `apps/mobile/tests/unit/supprButton.test.tsx`.
 */
import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";

import { SupprButton } from "@/app/components/suppr/suppr-button";

afterEach(() => cleanup());

describe("SupprButton (web)", () => {
  it("primary: solid fill + white label + pill + no border + no shadow", () => {
    render(<SupprButton variant="primary" label="Complete Day" />);
    const btn = screen.getByRole("button", { name: "Complete Day" });
    expect(btn.className).toContain("bg-primary-solid");
    expect(btn.className).toContain("text-white");
    expect(btn.className).toContain("rounded-full");
    expect(btn.className).toContain("border-0");
    expect(btn.className).toContain("shadow-none");
  });

  it("ghost: transparent + no border + plum label", () => {
    render(<SupprButton variant="ghost" label="Skip" />);
    const btn = screen.getByRole("button", { name: "Skip" });
    expect(btn.className).toContain("bg-transparent");
    expect(btn.className).toContain("text-primary-solid");
    expect(btn.className).toContain("border-0");
    expect(btn.className).toContain("shadow-none");
    // No SOLID fill: the only `bg-primary-solid` permitted on ghost is the
    // faint `/10` hover tint, never the unconditional fill the primary uses.
    expect(btn.className).not.toMatch(/(?:^|\s)bg-primary-solid(?:\s|$)/);
    expect(btn.className).toMatch(/hover:bg-primary-solid\/10/);
  });

  it("disabled blocks onClick", () => {
    const onClick = vi.fn();
    render(
      <SupprButton variant="primary" label="Save" onClick={onClick} disabled />,
    );
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading shows the spinner, sets aria-busy, and blocks onClick", () => {
    const onClick = vi.fn();
    render(
      <SupprButton variant="primary" label="Save" onClick={onClick} loading />,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn.querySelector(".animate-spin")).not.toBeNull();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("enabled primary fires onClick", () => {
    const onClick = vi.fn();
    render(<SupprButton variant="primary" label="Go" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
