import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  SupprMark,
  SupprPlateMark,
  SupprPlateWordmark,
  SupprWordmark,
} from "../../src/app/components/ui/suppr-mark";

void React;

/**
 * Sloe wordmark primitives (`suppr-mark.tsx`) — historical `Suppr*` export
 * names kept for call-site stability. Logo is the lowercase "sloe" in Fraunces
 * Light + plum (`--foreground-brand`), no plate glyph — family + casing +
 * weight match the v3 prototype's LOCKED Fraunces-only wordmark (supersedes the
 * 2026-06-08 Newsreader-semibold Figma treatment; Figma retired 2026-06-24).
 * The accessible name stays the proper-noun "Sloe".
 */

describe("SupprMark (Sloe wordmark)", () => {
  it("renders the lowercase wordmark with role=img and the proper-noun aria-label", () => {
    render(<SupprMark />);
    const mark = screen.getByRole("img", { name: "Sloe" });
    expect(mark).toHaveAttribute("data-slot", "sloe-mark");
    expect(mark.getAttribute("style")).toContain("sloe-wordmark.svg");
  });

  it("renders the splash logotype SVG as a recolorable mask (ENG-1247)", () => {
    // ENG-1247 (Grace 2026-06-26): a live Fraunces font (even Bold) "looked
    // nothing like" the splash, so the wordmark is now the canonical splash
    // asset (public/sloe-wordmark.svg) masked + filled via currentColor.
    render(<SupprMark />);
    const mark = screen.getByRole("img", { name: "Sloe" });
    expect(mark.getAttribute("style")).toContain("sloe-wordmark.svg");
    expect(mark.getAttribute("style")?.toLowerCase()).toContain("currentcolor");
  });

  it("scales by the 0.72 ratio — height tracks the mark size (ENG-797 parity)", () => {
    render(<SupprMark size={40} />);
    const mark = screen.getByRole("img", { name: "Sloe" });
    // sloeFontSize(40) = 29 → height round(29 * 1.15) = 33.
    expect(mark).toHaveStyle({ height: "33px" });
  });

  it("fills from the brand-ink token via currentColor (recolorable on dark surfaces)", () => {
    render(<SupprMark />);
    const mark = screen.getByRole("img", { name: "Sloe" });
    expect(mark.className).toContain("text-foreground-brand");
    expect(mark.getAttribute("style")?.toLowerCase()).toContain("currentcolor");
  });
});

describe("SupprPlateMark (deprecated alias)", () => {
  it("renders the same Sloe wordmark as SupprMark", () => {
    render(<SupprPlateMark />);
    expect(screen.getByRole("img", { name: "Sloe" })).toBeInTheDocument();
  });
});

describe("SupprPlateWordmark (deprecated alias)", () => {
  it("composes the Sloe wordmark lockup", () => {
    render(<SupprPlateWordmark />);
    expect(screen.getByRole("img", { name: "Sloe" })).toBeInTheDocument();
  });
});

describe("SupprWordmark", () => {
  it("composes the Sloe wordmark in a wrapper", () => {
    render(<SupprWordmark />);
    expect(screen.getByRole("img", { name: "Sloe" })).toBeInTheDocument();
  });

  it("matches plate wordmark ratio at the default size", () => {
    const { container: legacy } = render(<SupprWordmark size={28} />);
    const { container: plate } = render(<SupprPlateWordmark size={28} />);
    const legacyWord = legacy.querySelector('[data-slot="sloe-wordmark"]');
    const plateWord = plate.querySelector('[data-slot="sloe-wordmark"]');
    // sloeFontSize(28) = 20 → height round(20 * 1.15) = 23.
    expect(legacyWord).toHaveStyle({ height: "23px" });
    expect(plateWord).toHaveStyle({ height: "23px" });
  });
});
