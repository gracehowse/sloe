// @vitest-environment jsdom
/**
 * `RootErrorBoundary` (mobile) — ENG-799 brand-language recovery UI.
 *
 * The recovery render (`root-error-boundary-branded`): token colours, the
 * inline ring brand mark, and the blue CTA. Must: render the recovery copy,
 * capture the error exactly once, and recover (clear the error) when
 * "Try again" is pressed.
 *
 * ENG-1651 (2026-07-22): `redesign_branded_sheets` collapsed — the flag was
 * permanently ON via REDESIGN_DEFAULT_ON, so the branded layout is the only
 * recovery UI now. `RootErrorBoundary` no longer reads `isFeatureEnabled` at
 * all; the mock below is kept only to prove that (see "gate removed" below).
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { RootErrorBoundary } from "../../components/ui/RootErrorBoundary";
import { isFeatureEnabled } from "@/lib/analytics";
import { captureException } from "@/lib/errorTracking";

void React;

vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: vi.fn(() => false),
}));
vi.mock("@/lib/errorTracking", () => ({
  captureException: vi.fn(),
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;
const captureFn = captureException as unknown as ReturnType<typeof vi.fn>;

/** A child that throws on first render, then renders fine after a flag
 *  flips — lets us assert the "Try again" recovery path. */
function Boom({ throwIt }: { throwIt: { current: boolean } }) {
  if (throwIt.current) throw new Error("kaboom");
  return <></>;
}

describe("RootErrorBoundary (mobile) — ENG-799 branded recovery UI", () => {
  beforeEach(() => {
    flagFn.mockReset();
    flagFn.mockImplementation(() => false);
    captureFn.mockReset();
    // Silence React's expected error-boundary console noise.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("renders the branded recovery layout with the brand mark + CTA", () => {
    const throwIt = { current: true };
    const { getByText, getByTestId } = render(
      <RootErrorBoundary>
        <Boom throwIt={throwIt} />
      </RootErrorBoundary>,
    );
    expect(getByTestId("root-error-boundary-branded")).toBeTruthy();
    expect(getByText("Something went wrong")).toBeTruthy();
    expect(getByText("Try again")).toBeTruthy();
  });

  it("gate removed: renders the branded layout regardless of what an isFeatureEnabled mock returns for the retired flag", () => {
    flagFn.mockImplementation((f: string) => f === "redesign_branded_sheets");
    const throwIt = { current: true };
    const { getByTestId } = render(
      <RootErrorBoundary>
        <Boom throwIt={throwIt} />
      </RootErrorBoundary>,
    );
    expect(getByTestId("root-error-boundary-branded")).toBeTruthy();
    expect(flagFn).not.toHaveBeenCalled();
  });

  it("captures the error exactly once", () => {
    const throwIt = { current: true };
    render(
      <RootErrorBoundary>
        <Boom throwIt={throwIt} />
      </RootErrorBoundary>,
    );
    expect(captureFn).toHaveBeenCalledTimes(1);
  });

  it("'Try again' clears the error and re-renders children", () => {
    const throwIt = { current: true };
    const { getByText, queryByText, queryByTestId } = render(
      <RootErrorBoundary>
        <Boom throwIt={throwIt} />
      </RootErrorBoundary>,
    );
    // The child stops throwing, then we retry.
    throwIt.current = false;
    fireEvent.press(getByText("Try again"));
    expect(queryByTestId("root-error-boundary-branded")).toBeNull();
    expect(queryByText("Something went wrong")).toBeNull();
  });
});
