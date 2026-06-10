/**
 * FeatureErrorBoundary branded-fallback test (ENG-799, design-direction
 * 2026-05-31; ENG P5 web↔mobile parity, gap #8).
 *
 * Locks in the branded recovery card on web behind `redesign_branded_sheets`,
 * mirroring mobile `RootErrorBoundary.renderBranded()`:
 *
 *  - flag ON  → brand-language fallback: the canonical `SupprMark` brand mark,
 *    a brand background tone (`bg-background`), a primary CTA, and the calm
 *    "team has been notified" copy. (`data-testid="feature-error-boundary-branded"`)
 *  - flag OFF → the legacy slate card stays alive verbatim (no SupprMark,
 *    `bg-white/...` chrome). (no branded test id)
 *
 * The flag is mocked at the analytics boundary so both branches are exercised
 * deterministically (PostHog is never loaded in jsdom). The same mock controls
 * SupprMark's internal `design_system_brandmark` read.
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
  it("renders the legacy slate card when redesign_branded_sheets is OFF", () => {
    isFeatureEnabledSpy.mockReturnValue(false);
    // Suppress the expected React error-boundary console noise.
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <FeatureErrorBoundary feature="Progress">
        <Boom shouldThrow />
      </FeatureErrorBoundary>,
    );

    expect(screen.getByText("Progress ran into a problem")).toBeInTheDocument();
    // Legacy path: no branded surface, no brand mark.
    expect(screen.queryByTestId("feature-error-boundary-branded")).toBeNull();
    expect(screen.queryByRole("img", { name: "Sloe" })).toBeNull();
  });

  it("renders the branded fallback (brand mark + brand surface) when the flag is ON", () => {
    isFeatureEnabledSpy.mockReturnValue(true);
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

  it("reads the redesign_branded_sheets flag key", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <FeatureErrorBoundary feature="Progress">
        <Boom shouldThrow />
      </FeatureErrorBoundary>,
    );
    expect(isFeatureEnabledSpy).toHaveBeenCalledWith("redesign_branded_sheets");
  });

  it("falls back to legacy if the flag client throws", () => {
    isFeatureEnabledSpy.mockImplementation(() => {
      throw new Error("cold flag client");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <FeatureErrorBoundary feature="Recipes">
        <Boom shouldThrow />
      </FeatureErrorBoundary>,
    );

    // Recovery UI still renders (legacy), never crashes.
    expect(screen.getByText("Recipes ran into a problem")).toBeInTheDocument();
    expect(screen.queryByTestId("feature-error-boundary-branded")).toBeNull();
  });

  it("retry recovers the subtree when the child stops throwing (branded path)", () => {
    isFeatureEnabledSpy.mockReturnValue(true);
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
    isFeatureEnabledSpy.mockReturnValue(true);
    render(
      <FeatureErrorBoundary feature="Progress">
        <Boom shouldThrow={false} />
      </FeatureErrorBoundary>,
    );
    expect(screen.getByText("recovered")).toBeInTheDocument();
    expect(screen.queryByTestId("feature-error-boundary-branded")).toBeNull();
  });
});
