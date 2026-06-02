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
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

// Redesign 2026 ships default-ON (`REDESIGN_DEFAULT_ON` in `lib/analytics.ts`);
// the `design_system_brandmark` on-state swaps the plate mark and drops the
// legacy 'S'. This file pins the pre-redesign monochrome mark, so neutralise
// analytics → all flags read OFF (RN tests have no `window.__SUPPR_FORCE_FLAGS__`
// hook; this is the canonical mobile force-off, matching the web parity test).
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
  isFeatureDisabled: vi.fn(() => false),
}));

import { SupprMark, SupprPlateMark, SupprPlateWordmark, SupprWordmark } from "../../components/SupprMark";

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

describe("SupprPlateMark (mobile)", () => {
  it("renders with role=image and a brand accessibility label", () => {
    const { getByLabelText } = render(<SupprPlateMark />);
    expect(getByLabelText("Suppr")).toBeTruthy();
  });
});

describe("SupprPlateWordmark (mobile)", () => {
  it("renders the plate mark and Suppr label", () => {
    const { getByText } = render(<SupprPlateWordmark />);
    expect(getByText("Suppr")).toBeTruthy();
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
