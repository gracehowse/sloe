// @vitest-environment jsdom
/**
 * Mobile `SupprMark` render test — the Sloe wordmark. The logo is "Sloe"
 * (capital S) in Newsreader semibold + plum, matching the canonical Figma
 * `654:2` Today frame (updated 2026-06-08 from the earlier lowercase "sloe");
 * the berry glyph, plate ring, and legacy 'S' are retired.
 *
 * Mirrors the web test at `tests/unit/supprMark.test.tsx`. Locks in the
 * cross-platform invariant: both surfaces render the brand mark with the
 * SAME accessibility label ("Sloe") and the SAME "Sloe" word, so a
 * side-by-side parity check on the about / sign-in screens reads identically.
 * The `Suppr*` export names are kept until a rename pass (the component file
 * documents this); the rendered brand is "Sloe" on both.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import {
  SupprMark,
  SupprPlateMark,
  SupprPlateWordmark,
  SupprWordmark,
} from "../../components/SupprMark";

void React;

describe("SupprMark (mobile)", () => {
  it("renders with role=image and the Sloe brand accessibility label", () => {
    const { getByLabelText } = render(<SupprMark />);
    expect(getByLabelText("Sloe")).toBeTruthy();
  });

  it("renders the 'Sloe' wordmark (capital S, no legacy 'S' glyph)", () => {
    const { getByText, queryByText } = render(<SupprMark />);
    expect(getByText("Sloe")).toBeTruthy();
    // No standalone 'S' glyph — the wordmark is the whole word.
    expect(queryByText("S")).toBeNull();
  });
});

describe("SupprPlateMark (mobile)", () => {
  it("is an alias that renders the Sloe wordmark (plate motif retired)", () => {
    const { getByLabelText, getByText } = render(<SupprPlateMark />);
    expect(getByLabelText("Sloe")).toBeTruthy();
    expect(getByText("Sloe")).toBeTruthy();
  });
});

describe("SupprPlateWordmark (mobile)", () => {
  it("renders the Sloe wordmark", () => {
    const { getByText } = render(<SupprPlateWordmark />);
    expect(getByText("Sloe")).toBeTruthy();
  });
});

describe("SupprWordmark (mobile)", () => {
  it("renders the Sloe wordmark and exposes the brand label", () => {
    const { getByText, getAllByLabelText } = render(<SupprWordmark />);
    expect(getByText("Sloe")).toBeTruthy();
    // Wordmark wrapper + inner word both expose the "Sloe" label.
    expect(getAllByLabelText("Sloe").length).toBeGreaterThanOrEqual(1);
  });
});
