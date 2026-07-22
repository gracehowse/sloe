/**
 * FeatureErrorBoundary branded-fallback test (ENG-799, design-direction
 * 2026-05-31; ENG P5 web↔mobile parity, gap #8).
 *
 * Locks in the branded recovery card on web, mirroring mobile
 * `RootErrorBoundary.renderBranded()`: the canonical `SupprMark` brand mark,
 * a brand background tone (`bg-background`), a primary CTA, and the calm
 * "team has been notified" copy (`data-testid="feature-error-boundary-branded"`).
 *
 * ENG-1651 (2026-07-22): `redesign_branded_sheets` collapsed — the flag was
 * permanently ON via REDESIGN_DEFAULT_ON, so the legacy slate card (no
 * SupprMark, `bg-white/...` chrome) is gone. `FeatureErrorBoundary` no
 * longer reads `isFeatureEnabled` at all; the branded fallback is the only
 * path now. The mock below is kept only to prove that (see "gate removed"
 * below) — it has zero effect on the component's behaviour.
 */
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

void React;

const { isFeatureEnabledSpy } = vi.hoisted(() => ({
  isFeatureEnabledSpy: vi.fn((_flag: string) => false),
}));
vi.mock("../../src/lib/analytics/track.ts", () => ({
  isFeatureEnabled: isFeatureEnabledSpy,
}));

import { FeatureErrorBoundary } from "../../src/app/components/FeatureErrorBoundary";

/** A child that throws once on first render, then renders fine after retry. */
function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("boom");
  return <div>recovered</div>;
}

afterEach(() => {
  isFeatureEnabledSpy.mockReset();
  isFeatureEnabledSpy.mockReturnValue(false);
  vi.restoreAllMocks();
});

describe("FeatureErrorBoundary branded fallback (ENG-799)", () => {
  it("renders the branded fallback (brand mark + brand surface)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <FeatureErrorBoundary feature="Progress">
        <Boom shouldThrow />
      </FeatureErrorBoundary>,
    );

    const branded = screen.getByTestId("feature-error-boundary-branded");
    expect(branded).toBeInTheDocument();
    expect(branded.className).toContain("bg-background");
    // Brand mark present (mirrors mobile InlineBrandMark).
    expect(screen.getByRole("img", { name: "Sloe" })).toBeInTheDocument();
    // Calm parity copy.
    expect(screen.getByText(/team has been notified/i)).toBeInTheDocument();
    // Primary CTA preserved.
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("gate removed: rendering is unaffected by what an isFeatureEnabled mock returns for the retired flag", () => {
    isFeatureEnabledSpy.mockImplementation((flag: string) => flag === "redesign_branded_sheets");
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <FeatureErrorBoundary feature="Progress">
        <Boom shouldThrow />
      </FeatureErrorBoundary>,
    );

    expect(screen.getByTestId("feature-error-boundary-branded")).toBeInTheDocument();
    expect(isFeatureEnabledSpy).not.toHaveBeenCalled();
  });

  it("retry recovers the subtree when the child stops throwing", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    let throwNext = true;
    function Rerenderable() {
      return <Boom shouldThrow={throwNext} />;
    }

    render(
      <FeatureErrorBoundary feature="Progress">
        <Rerenderable />
      </FeatureErrorBoundary>,
    );

    expect(screen.getByTestId("feature-error-boundary-branded")).toBeInTheDocument();
    // Stop throwing, then hit Try again — the boundary resets and re-renders.
    throwNext = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("recovered")).toBeInTheDocument();
    expect(screen.queryByTestId("feature-error-boundary-branded")).toBeNull();
  });

  it("passes children through untouched when no error occurs", () => {
    render(
      <FeatureErrorBoundary feature="Progress">
        <Boom shouldThrow={false} />
      </FeatureErrorBoundary>,
    );
    expect(screen.getByText("recovered")).toBeInTheDocument();
    expect(screen.queryByTestId("feature-error-boundary-branded")).toBeNull();
  });
});
