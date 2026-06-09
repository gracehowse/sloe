import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Segmented } from "@/app/components/onboarding/segmented";

/**
 * Onboarding `Segmented` — active-segment treatment guard (Sloe).
 *
 * The metric/imperial pill on the Height + Weight onboarding steps. Sloe
 * treatment system (2026-06-08, rules 7–8): the active segment is a soft
 * aubergine TINT + deep-aubergine label, NOT a solid accent fill. The fill is
 * rationed to the FAB + conversion CTAs; small surfaces like a segmented
 * control carry the accent as a tint only. This mirrors the mobile
 * `MobileSegmented` (`Accent.primarySoft` bg + `Accent.primary` label) so web
 * and mobile stay in parity, and the approved component-treatment proto
 * (`docs/prototypes/sloe-component-treatments.html` — `.seg span.on`).
 *
 * Pins the active class set so a future edit can't regress the active segment
 * back to the pre-Sloe solid `bg-primary text-primary-foreground` slab.
 */
describe("onboarding Segmented — active segment is a soft tint, not a solid fill", () => {
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
  }

  it("active segment uses the aubergine soft tint + deep-aubergine label", () => {
    renderSegmented("metric");
    const active = screen.getByRole("radio", { name: "cm" });
    expect(active.getAttribute("aria-checked")).toBe("true");
    // Soft tint fill (10% aubergine) — NOT a solid accent slab.
    expect(active.className).toContain("bg-primary/10");
    // Deep-aubergine label (#4E3260) — AA on the 10% tint.
    expect(active.className).toContain("text-primary-solid");
  });

  it("active segment never paints the solid bg-primary / white-label fill", () => {
    renderSegmented("metric");
    const active = screen.getByRole("radio", { name: "cm" });
    // The pre-Sloe treatment was `bg-primary text-primary-foreground` — guard it
    // can't come back. `bg-primary/10` contains "bg-primary" as a substring, so
    // assert the solid token + the white label are absent via word boundaries.
    expect(active.className).not.toMatch(/bg-primary(?![/\w-])/);
    expect(active.className).not.toContain("text-primary-foreground");
  });

  it("inactive segment stays transparent + muted", () => {
    renderSegmented("metric");
    const inactive = screen.getByRole("radio", { name: "ft / in" });
    expect(inactive.getAttribute("aria-checked")).toBe("false");
    expect(inactive.className).toContain("bg-transparent");
    expect(inactive.className).toContain("text-muted-foreground");
  });
});
