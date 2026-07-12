import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Segmented } from "@/app/components/onboarding/segmented";

/**
 * Onboarding `Segmented` — active-segment treatment guard (Sloe).
 *
 * The metric/imperial pill on the Height + Weight onboarding steps. ENG-1375
 * S2 (§8 ruling, `docs/decisions/2026-07-10-chip-grammar-soft-tint.md`): the
 * control wraps the canonical `SegmentedTrack` — full-radius muted rail,
 * active segment = card-white thumb + `shadow-sm` + `primary-solid` semibold
 * label. The earlier soft-tint thumb (`bg-primary/10`) and the pre-Sloe solid
 * `bg-primary text-primary-foreground` slab are both retired; this pins that
 * neither comes back. Mirrors the mobile `MobileSegmented` (same primitive
 * grammar) so web and mobile stay in parity.
 */
describe("onboarding Segmented — §8 card-white thumb on the muted track", () => {
  const OPTIONS = [
    { value: "metric", label: "cm" },
    { value: "imperial", label: "ft / in" },
  ] as const;

  function renderSegmented(value: "metric" | "imperial") {
    const onChange = vi.fn();
    render(
      <Segmented
        options={OPTIONS as unknown as { value: string; label: React.ReactNode }[]}
        value={value}
        onChange={onChange}
        ariaLabel="Units"
      />,
    );
    return onChange;
  }

  it("active segment is the card-white thumb + primary-solid semibold label", () => {
    renderSegmented("metric");
    const active = screen.getByRole("radio", { name: "cm" });
    expect(active.getAttribute("aria-checked")).toBe("true");
    expect(active.className).toContain("bg-card");
    expect(active.className).toContain("shadow-sm");
    expect(active.className).toContain("font-semibold");
    // Deep-aubergine label (#4E3260) — AA on the card thumb.
    expect(active.className).toContain("text-primary-solid");
  });

  it("neither the solid slab nor the retired tint thumb ever comes back", () => {
    renderSegmented("metric");
    const active = screen.getByRole("radio", { name: "cm" });
    // Pre-Sloe solid: `bg-primary text-primary-foreground`.
    expect(active.className).not.toMatch(/bg-primary(?![/\w-])/);
    expect(active.className).not.toContain("text-primary-foreground");
    // Pre-§8 tint thumb: `bg-primary/10` (retired by ENG-1375 S2).
    expect(active.className).not.toContain("bg-primary/10");
  });

  it("inactive segment stays quiet on the rail (muted label, no thumb)", () => {
    renderSegmented("metric");
    const inactive = screen.getByRole("radio", { name: "ft / in" });
    expect(inactive.getAttribute("aria-checked")).toBe("false");
    expect(inactive.className).toContain("text-muted-foreground");
    expect(inactive.className).not.toContain("bg-card");
    expect(inactive.className).not.toContain("shadow-sm");
  });

  it("renders inside a radiogroup with the given label", () => {
    renderSegmented("metric");
    expect(screen.getByRole("radiogroup", { name: "Units" })).toBeTruthy();
  });
});
