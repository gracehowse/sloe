// @vitest-environment jsdom
/**
 * <SearchResultConfidenceChip> — the legible Verified / Estimated chip from
 * the 2026-05-31 search-results redesign, shared by the food-search, barcode
 * and voice-log result surfaces.
 *
 * Pins the load-bearing trust behaviour:
 *   - "verified"  → renders the "Verified" label.
 *   - "estimated" → renders the "Estimated" label.
 *   - both render a default testID of `confidence-chip` (the spec's hook for
 *     asserting a result card carries a confidence signal) and a sensible
 *     a11y label.
 *   - a custom testID overrides the default so the same chip can be addressed
 *     per-surface (barcode-confidence-chip / voice-confidence-chip).
 *
 * If the chip stops rendering the tier text or the testID, these break — so a
 * regression that silently drops the confidence signal can't ship.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { SearchResultConfidenceChip } from "../../components/ui/SearchResultConfidenceChip";

void React;

describe("SearchResultConfidenceChip", () => {
  it("renders the Structured label for the verified tier", () => {
    const { getByText, getByTestId } = render(
      <SearchResultConfidenceChip tier="verified" />,
    );
    expect(getByText("Structured")).toBeTruthy();
    expect(getByTestId("confidence-chip")).toBeTruthy();
  });

  it("renders the Estimated label for the estimated tier", () => {
    const { getByText } = render(<SearchResultConfidenceChip tier="estimated" />);
    expect(getByText("Estimated")).toBeTruthy();
  });

  it("exposes an a11y label that names the tier", () => {
    const { getByLabelText } = render(
      <SearchResultConfidenceChip tier="verified" />,
    );
    expect(getByLabelText("Structured nutrition data")).toBeTruthy();
  });

  it("honours a custom testID for per-surface addressing", () => {
    const { getByTestId, queryByTestId } = render(
      <SearchResultConfidenceChip tier="estimated" testID="voice-confidence-chip" />,
    );
    expect(getByTestId("voice-confidence-chip")).toBeTruthy();
    // The default testID is replaced, not added alongside.
    expect(queryByTestId("confidence-chip")).toBeNull();
  });

  it("respects a label override", () => {
    const { getByText } = render(
      <SearchResultConfidenceChip tier="verified" label="USDA" />,
    );
    expect(getByText("USDA")).toBeTruthy();
  });
});
