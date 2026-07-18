/**
 * <SearchResultConfidenceChip> (web) — the web twin of the mobile chip test
 * (`apps/mobile/tests/unit/searchResultConfidenceChip.test.tsx`). Pins the
 * load-bearing trust behaviour of the consolidated Verified/Estimated chip
 * (ENG-1429): correct labels + a11y, the honest warm-amber Estimated token
 * (never the over-budget `--warning` orange that paints the over-budget fat
 * macro in the same row), and per-surface testId addressing.
 *
 * If the chip stops rendering the tier text, swaps the estimated token for the
 * warning orange, or drops the testId, these break — so a regression that
 * silently corrupts the confidence signal can't ship.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SearchResultConfidenceChip } from "../../src/app/components/ui/search-result-confidence-chip";

void React;

describe("SearchResultConfidenceChip (web)", () => {
  it("renders the Structured label for the verified tier with the primary token, not amber", () => {
    render(<SearchResultConfidenceChip tier="verified" />);
    const chip = screen.getByTestId("confidence-chip");
    expect(screen.getByText("Structured")).toBeInTheDocument();
    expect(chip.className).toMatch(/\bbg-primary\/10\b/);
    expect(chip.className).toMatch(/\btext-primary-solid\b/);
    // Verified carries no inline estimated tint.
    expect(chip.style.color).toBe("");
    expect(chip.style.backgroundColor).toBe("");
  });

  it("renders the Estimated label with the warm-amber token, never the --warning orange", () => {
    render(<SearchResultConfidenceChip tier="estimated" />);
    const chip = screen.getByTestId("confidence-chip");
    expect(screen.getByText("Estimated")).toBeInTheDocument();
    expect(chip.style.color).toContain("var(--chip-estimated)");
    expect(chip.style.backgroundColor).toContain("var(--chip-estimated-soft)");
    expect(chip.className).not.toMatch(/\btext-warning\b/);
    expect(chip.className).not.toMatch(/\bbg-warning\b/);
  });

  it("exposes an a11y label that names the tier", () => {
    render(<SearchResultConfidenceChip tier="verified" />);
    expect(screen.getByLabelText("Structured nutrition data")).toBeInTheDocument();
  });

  it("honours a custom testId for per-surface addressing", () => {
    render(<SearchResultConfidenceChip tier="estimated" testId="voice-confidence-chip" />);
    expect(screen.getByTestId("voice-confidence-chip")).toBeInTheDocument();
    // The default testId is replaced, not added alongside.
    expect(screen.queryByTestId("confidence-chip")).toBeNull();
  });

  it("respects a label override", () => {
    render(<SearchResultConfidenceChip tier="verified" label="USDA" />);
    expect(screen.getByText("USDA")).toBeInTheDocument();
  });
});
