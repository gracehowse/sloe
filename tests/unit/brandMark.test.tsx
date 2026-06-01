/**
 * Brand-mark canonical-unify test (ENG-797, design-direction 2026-05-31).
 *
 * Locks in the single-canonical-mark contract on web:
 *
 *  - `SupprMark` is the canonical entry point. When the
 *    `design_system_brandmark` flag is ON it renders the canonical
 *    ring motif (concentric circles, `data-slot="suppr-plate-mark"`)
 *    — NOT the legacy S-glyph.
 *  - When the flag is OFF (the default in a fresh PostHog client and
 *    in this test environment) it falls back to the legacy S-glyph so
 *    the old path stays alive until the flag is at 100%.
 *  - `SupprPlateMark` always renders the canonical ring motif.
 *
 * The flag is mocked at the analytics boundary so both branches are
 * exercised deterministically (PostHog is never loaded in jsdom).
 */
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

void React;

// `vi.mock` factories are hoisted, so the spy lives in the same hoisted
// scope. Default the flag OFF; individual tests flip it on.
const { isFeatureEnabledSpy } = vi.hoisted(() => ({
  isFeatureEnabledSpy: vi.fn(() => false),
}));
vi.mock("../../src/lib/analytics/track.ts", () => ({
  isFeatureEnabled: isFeatureEnabledSpy,
}));

import {
  SupprMark,
  SupprPlateMark,
  SupprPlateWordmark,
} from "../../src/app/components/ui/suppr-mark";

afterEach(() => {
  isFeatureEnabledSpy.mockReset();
  isFeatureEnabledSpy.mockReturnValue(false);
});

describe("SupprMark canonical-unify (ENG-797)", () => {
  it("renders the legacy S-glyph when design_system_brandmark is OFF", () => {
    isFeatureEnabledSpy.mockReturnValue(false);
    const { container } = render(<SupprMark />);
    // Legacy glyph path: a <text>S</text> exists, no concentric rings.
    const text = container.querySelector("text");
    expect(text?.textContent).toBe("S");
    expect(container.querySelector("circle")).toBeNull();
  });

  it("renders the canonical ring motif when design_system_brandmark is ON", () => {
    isFeatureEnabledSpy.mockReturnValue(true);
    const { container } = render(<SupprMark />);
    // Canonical path: concentric rings, no S-glyph text node.
    expect(container.querySelector("circle")).not.toBeNull();
    expect(container.querySelector("text")).toBeNull();
    const svg = screen.getByRole("img", { name: "Suppr" });
    expect(svg).toHaveAttribute("data-slot", "suppr-plate-mark");
  });

  it("passes the design_system_brandmark flag key to isFeatureEnabled", () => {
    render(<SupprMark />);
    expect(isFeatureEnabledSpy).toHaveBeenCalledWith("design_system_brandmark");
  });

  it("forwards the size prop in both flag states", () => {
    isFeatureEnabledSpy.mockReturnValue(false);
    const { container: off } = render(<SupprMark size={48} />);
    expect(off.querySelector("svg")?.getAttribute("width")).toBe("48");

    isFeatureEnabledSpy.mockReturnValue(true);
    const { container: on } = render(<SupprMark size={48} />);
    expect(on.querySelector("svg")?.getAttribute("width")).toBe("48");
  });
});

describe("SupprPlateMark — always canonical (ENG-797)", () => {
  it("renders the concentric-ring motif regardless of flag state", () => {
    isFeatureEnabledSpy.mockReturnValue(false);
    const { container } = render(<SupprPlateMark />);
    expect(container.querySelectorAll("circle").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector("text")).toBeNull();
  });

  it("composes with the Suppr word in the wordmark", () => {
    render(<SupprPlateWordmark />);
    expect(screen.getByText("Suppr")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Suppr" })).toBeInTheDocument();
  });
});
