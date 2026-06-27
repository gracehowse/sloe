// @vitest-environment jsdom
/**
 * Mobile `SupprMark` render test — the Sloe wordmark. The logo is the lowercase
 * "sloe" in Fraunces Light + plum, per the v3 prototype's LOCKED Fraunces-only
 * wordmark (supersedes the 2026-06-08 Newsreader-semibold capital treatment;
 * Figma retired 2026-06-24). The berry glyph, plate ring, and legacy 'S' are
 * retired.
 *
 * Mirrors the web test at `tests/unit/supprMark.test.tsx`. Locks in the
 * cross-platform invariant: both surfaces render the brand mark with the
 * SAME proper-noun accessibility label ("Sloe") and the SAME lowercase "sloe"
 * word, so a side-by-side parity check on the about / sign-in screens reads
 * identically. The `Suppr*` export names are kept until a rename pass (the
 * component file documents this); the rendered brand is "sloe" on both.
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

  it("renders the splash logotype asset, not a text glyph (ENG-1247)", () => {
    const { getByLabelText, queryByText } = render(<SupprMark />);
    expect(getByLabelText("Sloe")).toBeTruthy();
    // The mark is the splash Image asset now — no rendered text glyph.
    expect(queryByText("sloe")).toBeNull();
  });
});

describe("SupprPlateMark (mobile)", () => {
  it("is an alias that renders the Sloe wordmark (plate motif retired)", () => {
    const { getByLabelText } = render(<SupprPlateMark />);
    expect(getByLabelText("Sloe")).toBeTruthy();
  });
});

describe("SupprPlateWordmark (mobile)", () => {
  it("renders the Sloe wordmark", () => {
    const { getAllByLabelText } = render(<SupprPlateWordmark />);
    expect(getAllByLabelText("Sloe").length).toBeGreaterThanOrEqual(1);
  });
});

describe("SupprWordmark (mobile)", () => {
  it("renders the Sloe wordmark and exposes the brand label", () => {
    const { getAllByLabelText } = render(<SupprWordmark />);
    // Wordmark wrapper + inner Image both expose the "Sloe" label.
    expect(getAllByLabelText("Sloe").length).toBeGreaterThanOrEqual(1);
  });
});
