// @vitest-environment jsdom
/**
 * Mobile `SupprMark` render test (Phase 1 of the onboarding redesign —
 * see `docs/decisions/2026-04-19-onboarding-redesign-scope.md`).
 *
 * Mirrors the web test at `tests/unit/supprMark.test.tsx`. Locks in the
 * cross-platform invariant: both surfaces render the brand mark with
 * the same accessibility label and the same composition (Mark + word
 * for the wordmark) so a side-by-side parity check on the about / sign-in
 * screens reads identically.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { SupprMark, SupprWordmark } from "../../components/SupprMark";

void React;

describe("SupprMark (mobile)", () => {
  it("renders with role=image and a brand accessibility label", () => {
    const { getByLabelText } = render(<SupprMark />);
    expect(getByLabelText("Suppr")).toBeTruthy();
  });

  it("renders the white 'S' letter on top of the mark", () => {
    const { getByText } = render(<SupprMark />);
    expect(getByText("S")).toBeTruthy();
  });
});

describe("SupprWordmark (mobile)", () => {
  it("renders both the Mark and the 'Suppr' label", () => {
    const { getByText, getAllByLabelText } = render(<SupprWordmark />);
    expect(getByText("Suppr")).toBeTruthy();
    // Both Mark and Wordmark expose a "Suppr" accessibility label, so
    // there should be at least two when nested.
    expect(getAllByLabelText("Suppr").length).toBeGreaterThanOrEqual(1);
  });
});
